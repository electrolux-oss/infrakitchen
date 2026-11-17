import base64
import hashlib
import secrets
from types import SimpleNamespace
from unittest.mock import AsyncMock

import httpx
import jwt
import pytest
from mcp.server.auth.provider import AuthorizationParams, RegistrationError, TokenError
from mcp.shared.auth import OAuthClientInformationFull
from pydantic import AnyUrl

from mcp_server import oauth_provider as op

PUBLIC_URL = "https://ik.example.com"


@pytest.fixture
def memory_store(monkeypatch):
    data: dict[tuple[str, str], str] = {}

    async def put(kind, key, value, ttl):
        data[(kind, key)] = value.model_dump_json()

    async def get(kind, key, model):
        raw = data.get((kind, key))
        return None if raw is None else model.model_validate_json(raw)

    async def pop(kind, key, model):
        raw = data.pop((kind, key), None)
        return None if raw is None else model.model_validate_json(raw)

    async def delete(kind, key):
        data.pop((kind, key), None)

    for name, fn in {"put": put, "get": get, "pop": pop, "delete": delete}.items():
        monkeypatch.setattr(op, f"store_{name}", fn)
    return data


@pytest.fixture
def provider(monkeypatch, memory_store):
    monkeypatch.setenv("INFRAKITCHEN_URL", PUBLIC_URL)
    user = SimpleNamespace(identifier="alice@example.com", deactivated=False)
    monkeypatch.setattr(op, "_get_user", AsyncMock(return_value=user))
    forwarded_scopes: list[list[str] | None] = []

    def fake_create_user_token(u, exp, scopes=None):
        forwarded_scopes.append(scopes)
        return "forwarded-session-jwt"

    monkeypatch.setattr(op, "create_user_token", fake_create_user_token)
    p = op.InfraKitchenOAuthProvider(base_url=f"{PUBLIC_URL}/api/mcp", internal_client=httpx.AsyncClient())
    p.forwarded_scopes = forwarded_scopes  # pyright: ignore[reportAttributeAccessIssue]
    return p


def _client(redirect_uri="http://127.0.0.1:3334/callback", auth_method="none"):
    return OAuthClientInformationFull(
        client_id="client-1",
        redirect_uris=[AnyUrl(redirect_uri)],
        token_endpoint_auth_method=auth_method,
        grant_types=["authorization_code", "refresh_token"],
        response_types=["code"],
    )


async def _authorize(provider, client):
    verifier = secrets.token_urlsafe(32)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    redirect = await provider.authorize(
        client,
        AuthorizationParams(
            state="xyz",
            scopes=[],
            code_challenge=challenge,
            redirect_uri=client.redirect_uris[0],
            redirect_uri_provided_explicitly=True,
            resource=f"{PUBLIC_URL}/api/mcp/",
        ),
    )
    assert redirect.startswith(f"{PUBLIC_URL}{op.CONSENT_PATH}?txn=")
    return redirect.split("txn=")[1]


@pytest.mark.parametrize(
    "uri",
    [
        "https://app.example.com/cb",
        "http://localhost:1234/cb",
        "http://127.0.0.1/cb",
        "cursor://anysphere.cursor-mcp/oauth/callback",
    ],
)
@pytest.mark.asyncio
async def test_register_accepts_safe_redirect_uris(provider, uri):
    await provider.register_client(_client(uri))
    assert await provider.get_client("client-1") is not None


@pytest.mark.parametrize(
    "uri",
    ["http://evil.example.com/cb", "javascript://x/%0aalert(1)", "data://text/html,hi", "https://app.example.com/cb#f"],
)
@pytest.mark.asyncio
async def test_register_rejects_unsafe_redirect_uris(provider, uri):
    with pytest.raises(RegistrationError):
        await provider.register_client(_client(uri))


@pytest.mark.asyncio
async def test_register_downgrades_client_secret_basic(provider):
    client = _client(auth_method="client_secret_basic")
    await provider.register_client(client)
    assert client.token_endpoint_auth_method == "client_secret_post"


@pytest.mark.asyncio
async def test_full_code_and_refresh_flow(provider, memory_store):
    client = _client()
    await provider.register_client(client)
    txn = await _authorize(provider, client)

    redirect = await provider.create_authorization_code(txn, "alice@example.com", ["read:resource", "write:resource"])
    assert redirect is not None and "state=xyz" in redirect
    code_value = redirect.split("code=")[1].split("&")[0]

    # Raw code is never persisted.
    assert all(code_value not in v for v in memory_store.values())

    code = await provider.load_authorization_code(client, code_value)
    assert code is not None and code.code == code_value
    tokens = await provider.exchange_authorization_code(client, code)

    # Single use.
    assert await provider.load_authorization_code(client, code_value) is None
    with pytest.raises(TokenError):
        await provider.exchange_authorization_code(client, code)

    access = await provider.load_access_token(tokens.access_token)
    assert access is not None
    assert access.claims["ik_authorization"] == "Bearer forwarded-session-jwt"
    assert tokens.scope == "read:resource write:resource"
    assert provider.forwarded_scopes[-1] == ["read:resource", "write:resource"]
    assert jwt.decode(tokens.access_token, options={"verify_signature": False})["aud"] == op.MCP_TOKEN_AUDIENCE

    assert tokens.refresh_token is not None
    refresh = await provider.load_refresh_token(client, tokens.refresh_token)
    assert refresh is not None
    new_tokens = await provider.exchange_refresh_token(client, refresh, [])
    assert new_tokens.refresh_token != tokens.refresh_token
    # Rotation: the old refresh token is gone.
    assert await provider.load_refresh_token(client, tokens.refresh_token) is None


@pytest.mark.asyncio
async def test_code_bound_to_client(provider):
    client = _client()
    await provider.register_client(client)
    txn = await _authorize(provider, client)
    redirect = await provider.create_authorization_code(txn, "alice@example.com", None)
    code_value = redirect.split("code=")[1].split("&")[0]

    other = _client().model_copy(update={"client_id": "client-2"})
    assert await provider.load_authorization_code(other, code_value) is None


@pytest.mark.asyncio
async def test_deny_redirects_with_error(provider):
    client = _client()
    await provider.register_client(client)
    txn = await _authorize(provider, client)
    redirect = await provider.deny_authorization(txn)
    assert redirect is not None and "error=access_denied" in redirect
    assert await provider.get_pending(txn) is None


@pytest.mark.asyncio
async def test_session_jwt_is_not_an_mcp_token(provider, monkeypatch):
    session_token = jwt.encode({"sub": "x", "aud": "infrakitchen"}, key=op._jwt_key(), algorithm="HS256")
    legacy = AsyncMock(return_value=None)
    monkeypatch.setattr(provider, "_load_legacy_token", legacy)
    assert await provider.load_access_token(session_token) is None
    legacy.assert_awaited_once()


@pytest.mark.asyncio
async def test_full_access_grant_forwards_unscoped_token(provider):
    client = _client()
    await provider.register_client(client)
    txn = await _authorize(provider, client)
    redirect = await provider.create_authorization_code(txn, "alice@example.com", None)
    code_value = redirect.split("code=")[1].split("&")[0]
    code = await provider.load_authorization_code(client, code_value)
    tokens = await provider.exchange_authorization_code(client, code)

    assert tokens.scope == op.FULL_ACCESS_SCOPE
    assert await provider.load_access_token(tokens.access_token) is not None
    assert provider.forwarded_scopes[-1] is None


@pytest.mark.asyncio
async def test_refresh_keeps_granted_scopes(provider):
    client = _client()
    await provider.register_client(client)
    txn = await _authorize(provider, client)
    redirect = await provider.create_authorization_code(txn, "alice@example.com", ["read:template"])
    code_value = redirect.split("code=")[1].split("&")[0]
    tokens = await provider.exchange_authorization_code(
        client, await provider.load_authorization_code(client, code_value)
    )
    refresh = await provider.load_refresh_token(client, tokens.refresh_token)
    new_tokens = await provider.exchange_refresh_token(client, refresh, [])
    assert new_tokens.scope == "read:template"

    refresh = await provider.load_refresh_token(client, new_tokens.refresh_token)
    with pytest.raises(TokenError):
        await provider.exchange_refresh_token(client, refresh, ["write:template"])
