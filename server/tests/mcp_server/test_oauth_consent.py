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

    async def get_pending(self, txn):
        return self.pending.get(txn)

    async def create_authorization_code(self, txn, identifier):
        if self.pending.pop(txn, None) is None:
            return None
        self.approved_for = identifier
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


def _csrf_from(html: str) -> str:
    return html.split('name="csrf" value="')[1].split('"')[0]


def test_consent_page_propagates_rotated_refresh_cookie(client):
    r = client.get(f"{CONSENT_PATH}?txn=txn-1")
    assert r.status_code == 200
    assert "Test Client" in r.text
    set_cookies = r.headers.get_list("set-cookie")
    assert any(c.startswith("microsoft-refresh-token=rotated") for c in set_cookies)
    assert any(c.startswith(f"{oauth_consent.CONSENT_NONCE_COOKIE}=") for c in set_cookies)
    assert r.headers["x-frame-options"] == "DENY"


def test_allow_issues_code_for_signed_in_user(client):
    page = client.get(f"{CONSENT_PATH}?txn=txn-1")
    r = client.post(
        CONSENT_PATH,
        data={"txn": "txn-1", "csrf": _csrf_from(page.text), "decision": "allow"},
        headers={"Origin": PUBLIC_URL},
        follow_redirects=False,
    )
    assert r.status_code == 303
    assert r.headers["location"].startswith("http://127.0.0.1:3334/callback?code=")
    assert client.provider.approved_for == "alice@example.com"


def test_csrf_rejected_without_browser_nonce(client):
    page = client.get(f"{CONSENT_PATH}?txn=txn-1")
    client.cookies.delete(oauth_consent.CONSENT_NONCE_COOKIE)
    r = client.post(
        CONSENT_PATH,
        data={"txn": "txn-1", "csrf": _csrf_from(page.text), "decision": "allow"},
        headers={"Origin": PUBLIC_URL},
        follow_redirects=False,
    )
    assert r.status_code == 400
    assert client.provider.approved_for is None


def test_csrf_rejected_when_user_changed(client):
    page = client.get(f"{CONSENT_PATH}?txn=txn-1")
    client.current["identifier"] = "mallory@example.com"
    r = client.post(
        CONSENT_PATH,
        data={"txn": "txn-1", "csrf": _csrf_from(page.text), "decision": "allow"},
        headers={"Origin": PUBLIC_URL},
        follow_redirects=False,
    )
    assert r.status_code == 400
    assert client.provider.approved_for is None


def test_cross_origin_post_rejected(client):
    page = client.get(f"{CONSENT_PATH}?txn=txn-1")
    r = client.post(
        CONSENT_PATH,
        data={"txn": "txn-1", "csrf": _csrf_from(page.text), "decision": "allow"},
        headers={"Origin": "https://evil.example.com"},
        follow_redirects=False,
    )
    assert r.status_code == 400


def test_null_origin_from_same_site_is_allowed(client):
    # Browsers send `Origin: null` after redirect chains such as the SSO login.
    page = client.get(f"{CONSENT_PATH}?txn=txn-1")
    r = client.post(
        CONSENT_PATH,
        data={"txn": "txn-1", "csrf": _csrf_from(page.text), "decision": "allow"},
        headers={"Origin": "null", "Sec-Fetch-Site": "same-origin"},
        follow_redirects=False,
    )
    assert r.status_code == 303
    assert client.provider.approved_for == "alice@example.com"


def test_null_origin_cross_site_rejected(client):
    page = client.get(f"{CONSENT_PATH}?txn=txn-1")
    r = client.post(
        CONSENT_PATH,
        data={"txn": "txn-1", "csrf": _csrf_from(page.text), "decision": "allow"},
        headers={"Origin": "null", "Sec-Fetch-Site": "cross-site"},
        follow_redirects=False,
    )
    assert r.status_code == 400
    assert client.provider.approved_for is None


def test_not_signed_in_redirects_to_login_with_return_to(client):
    client.cookies.clear()
    r = client.get(f"{CONSENT_PATH}?txn=txn-1", follow_redirects=False)
    assert r.status_code == 307
    assert r.headers["location"] == "/"
    assert any(c.startswith("ik-return-to=") for c in r.headers.get_list("set-cookie"))
