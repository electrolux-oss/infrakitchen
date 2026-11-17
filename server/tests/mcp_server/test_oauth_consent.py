from typing import cast

import jwt
import pytest
from fastapi import FastAPI, Response
from fastapi.testclient import TestClient

from core.config import Settings
from core.sso.dependencies import get_sso_service
from mcp_server import oauth_consent
from pydantic import AnyUrl

from mcp_server.oauth_provider import CONSENT_PATH, InfraKitchenOAuthProvider, PendingAuthorization

PUBLIC_URL = "https://ik.example.com"


class FakeProvider:
    def __init__(self):
        self.pending = {
            "txn-1": PendingAuthorization(
                client_id="client-1",
                client_name="Test Client",
                redirect_uri=AnyUrl("http://127.0.0.1:3334/callback"),
                redirect_uri_provided_explicitly=True,
                state="xyz",
                scopes=[],
                code_challenge="c",
                resource=None,
            )
        }
        self.approved_for: str | None = None
        self.approved_scopes: list[str] | None = None

    async def get_pending(self, txn):
        return self.pending.get(txn)

    async def create_authorization_code(self, txn, identifier, scopes):
        if self.pending.pop(txn, None) is None:
            return None
        self.approved_for = identifier
        self.approved_scopes = scopes
        return "http://127.0.0.1:3334/callback?code=abc&state=xyz"

    async def deny_authorization(self, txn):
        return None if self.pending.pop(txn, None) is None else "http://127.0.0.1:3334/callback?error=access_denied"


class ConsentClient(TestClient):
    def __init__(self, app: FastAPI, provider: FakeProvider, current: dict[str, str]):
        super().__init__(app, base_url=PUBLIC_URL)
        self.provider = provider
        self.current = current


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("INFRAKITCHEN_URL", PUBLIC_URL)
    provider = FakeProvider()
    oauth_consent.set_oauth_provider(cast(InfraKitchenOAuthProvider, cast(object, provider)))
    current = {"identifier": "alice@example.com"}

    async def fake_refresh(service, request, response: Response, cookie=None):
        # Simulates a provider rotating its refresh token.
        response.set_cookie("microsoft-refresh-token", "rotated", httponly=True, secure=True)
        token = jwt.encode(
            {"pld": {"identifier": current["identifier"]}, "aud": "infrakitchen"},
            key=Settings().JWT_KEY,
            algorithm="HS256",
        )
        return {"token": token}

    monkeypatch.setattr(oauth_consent, "microsoft_refresh_token", fake_refresh)
    app = FastAPI()
    app.include_router(oauth_consent.router, prefix="/api")
    app.dependency_overrides[get_sso_service] = lambda: None
    tc = ConsentClient(app, provider, current)
    tc.cookies.set("microsoft-refresh-token", "original")
    yield tc
    oauth_consent.set_oauth_provider(None)


REQUEST_PATH = "/api/mcp-oauth/requests/txn-1"


def _csrf(client) -> str:
    r = client.get(REQUEST_PATH)
    assert r.status_code == 200
    return r.json()["csrf"]


def _submit(client, csrf, decision="allow", scopes=None, headers=None):
    return client.post(
        REQUEST_PATH,
        json={"csrf": csrf, "decision": decision, "scopes": scopes},
        headers={"Origin": PUBLIC_URL} if headers is None else headers,
    )


def test_entry_redirects_signed_in_user_to_ui(client):
    r = client.get(f"{CONSENT_PATH}?txn=txn-1", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"] == "/mcp-oauth/consent?txn=txn-1"
    assert any(c.startswith("microsoft-refresh-token=rotated") for c in r.headers.get_list("set-cookie"))


def test_entry_not_signed_in_redirects_to_login_with_return_to(client):
    client.cookies.clear()
    r = client.get(f"{CONSENT_PATH}?txn=txn-1", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"] == "/"
    assert any(c.startswith("ik-return-to=") for c in r.headers.get_list("set-cookie"))


def test_request_details_propagate_rotated_refresh_cookie(client):
    r = client.get(REQUEST_PATH)
    assert r.status_code == 200
    data = r.json()
    assert data["client_name"] == "Test Client"
    assert data["redirect_host"] == "127.0.0.1"
    assert data["user"] == "alice@example.com"
    set_cookies = r.headers.get_list("set-cookie")
    assert any(c.startswith("microsoft-refresh-token=rotated") for c in set_cookies)
    assert any(c.startswith(f"{oauth_consent.CONSENT_NONCE_COOKIE}=") for c in set_cookies)


def test_request_details_expired(client):
    assert client.get("/api/mcp-oauth/requests/unknown").status_code == 404


def test_request_details_require_sign_in(client):
    client.cookies.clear()
    assert client.get(REQUEST_PATH).status_code == 401


def test_allow_with_scopes(client):
    r = _submit(client, _csrf(client), scopes=["read:resource", "write:resource"])
    assert r.status_code == 200
    assert r.json()["redirect_url"].startswith("http://127.0.0.1:3334/callback?code=")
    assert client.provider.approved_for == "alice@example.com"
    assert client.provider.approved_scopes == ["read:resource", "write:resource"]


def test_allow_full_access(client):
    r = _submit(client, _csrf(client), scopes=None)
    assert r.status_code == 200
    assert client.provider.approved_scopes is None


@pytest.mark.parametrize("scopes", [[], ["admin:resource"], ["read:*"], ["delete:resource"]])
def test_invalid_scopes_rejected(client, scopes):
    r = _submit(client, _csrf(client), scopes=scopes)
    assert r.status_code == 400
    assert client.provider.approved_for is None


def test_deny(client):
    r = _submit(client, _csrf(client), decision="deny")
    assert r.status_code == 200
    assert "error=access_denied" in r.json()["redirect_url"]
    assert client.provider.approved_for is None


def test_csrf_rejected_without_browser_nonce(client):
    csrf = _csrf(client)
    client.cookies.delete(oauth_consent.CONSENT_NONCE_COOKIE)
    assert _submit(client, csrf).status_code == 400
    assert client.provider.approved_for is None


def test_csrf_rejected_when_user_changed(client):
    csrf = _csrf(client)
    client.current["identifier"] = "mallory@example.com"
    assert _submit(client, csrf).status_code == 400
    assert client.provider.approved_for is None


def test_cross_origin_post_rejected(client):
    assert _submit(client, _csrf(client), headers={"Origin": "https://evil.example.com"}).status_code == 400


def test_null_origin_from_same_site_is_allowed(client):
    r = _submit(client, _csrf(client), headers={"Origin": "null", "Sec-Fetch-Site": "same-origin"})
    assert r.status_code == 200


def test_null_origin_cross_site_rejected(client):
    r = _submit(client, _csrf(client), headers={"Origin": "null", "Sec-Fetch-Site": "cross-site"})
    assert r.status_code == 400
    assert client.provider.approved_for is None
