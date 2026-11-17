"""OAuth 2.1 authorization server for the InfraKitchen MCP endpoint.

FastMCP / the MCP SDK handle the protocol (metadata, dynamic client registration, PKCE,
redirect-URI validation, token endpoint). This module only plugs in InfraKitchen specifics:
storage (Postgres `caches` table), user login + consent (see `oauth_consent.py`) and token minting.

Tokens issued here are only accepted by the MCP endpoint (audience `infrakitchen-mcp`).
Legacy bearer tokens (session JWTs, personal access tokens, service accounts) keep working.
"""

import hashlib
import secrets
import time
from datetime import UTC, datetime, timedelta

import httpx
import jwt
from mcp.server.auth.provider import (
    AuthorizationCode,
    AuthorizationParams,
    RefreshToken,
    RegistrationError,
    TokenError,
    construct_redirect_uri,
)
from mcp.server.auth.settings import ClientRegistrationOptions, RevocationOptions
from mcp.shared.auth import OAuthClientInformationFull, OAuthToken
from pydantic import AnyHttpUrl, AnyUrl, BaseModel

from fastmcp.server.auth.auth import AccessToken, OAuthProvider

from core.config import Settings
from core.dependencies import get_async_session
from core.sso.functions import create_user_token
from core.users.dependencies import get_user_service

from .oauth_store import delete as store_delete
from .oauth_store import get as store_get
from .oauth_store import pop as store_pop
from .oauth_store import put as store_put

MCP_TOKEN_AUDIENCE = "infrakitchen-mcp"
AUTH_PROBE_PATH = "/api/auth/me"

ACCESS_TOKEN_TTL = timedelta(hours=1)
REFRESH_TOKEN_TTL = timedelta(days=30)
AUTH_CODE_TTL = timedelta(minutes=5)
PENDING_TTL = timedelta(minutes=10)
FORWARDED_TOKEN_TTL = timedelta(minutes=10)

CONSENT_PATH = "/api/mcp-oauth/consent"

# Granted when the user picks "full access" on the consent page: the token then acts with the
# user's own permissions, like an unscoped personal access token. Otherwise the grant holds
# "<read|write>:<entity>" scopes, enforced like scoped personal access tokens.
FULL_ACCESS_SCOPE = "full_access"


def token_scopes_for_grant(scopes: list[str]) -> list[str] | None:
    """Scopes to enforce for a grant; None means unrestricted (full access)."""
    return None if FULL_ACCESS_SCOPE in scopes else scopes


class PendingAuthorization(BaseModel):
    client_id: str
    client_name: str | None
    redirect_uri: AnyUrl
    redirect_uri_provided_explicitly: bool
    state: str | None
    scopes: list[str]
    code_challenge: str
    resource: str | None


def _hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def _jwt_key() -> str:
    key = Settings().JWT_KEY
    if not key:
        raise ValueError("JWT_KEY is not set")
    return key


async def _get_user(identifier: str):
    async with get_async_session() as session:
        user = await get_user_service(session=session).get_user_by_identifier(identifier)
    if user is None or user.deactivated:
        return None
    return user


_BLOCKED_SCHEMES = {"javascript", "data", "file", "vbscript", "about", "blob", "ftp", "ws", "wss"}
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}


def _is_safe_redirect_uri(uri: AnyUrl) -> bool:
    """https anywhere, http only on loopback, or a private-use scheme for native apps (RFC 8252)."""
    scheme = (uri.scheme or "").lower()
    if uri.fragment is not None or scheme in _BLOCKED_SCHEMES:
        return False
    if scheme == "https":
        return bool(uri.host)
    if scheme == "http":
        return (uri.host or "").lower() in _LOOPBACK_HOSTS
    # Private-use schemes (e.g. cursor://, vscode://) must look like reverse-DNS or an app name.
    return scheme.isascii() and scheme[:1].isalpha()


def _is_loopback_http(uri: AnyUrl) -> bool:
    return uri.scheme == "http" and (uri.host or "").lower() in _LOOPBACK_HOSTS


class _ClientInformation(OAuthClientInformationFull):
    """Registered client whose loopback redirect URIs accept any port (RFC 8252 section 7.3).

    Native clients (OpenCode, Claude Code, ...) listen on a fresh ephemeral port for every
    login but reuse their earlier registration.
    """

    def validate_redirect_uri(self, redirect_uri: AnyUrl | None) -> AnyUrl:
        if redirect_uri is not None and _is_loopback_http(redirect_uri):
            for registered in self.redirect_uris or []:
                if (
                    _is_loopback_http(registered)
                    and registered.host == redirect_uri.host
                    and (registered.path or "/") == (redirect_uri.path or "/")
                    and registered.query == redirect_uri.query
                ):
                    return redirect_uri
        return super().validate_redirect_uri(redirect_uri)


class InfraKitchenOAuthProvider(OAuthProvider):
    def __init__(self, *, base_url: str, internal_client: httpx.AsyncClient):
        super().__init__(
            base_url=base_url,
            client_registration_options=ClientRegistrationOptions(enabled=True),
            # The SDK's revocation endpoint rejects public clients (client_secret is required in the
            # form), so keep it off until that is fixed upstream. Refresh tokens still expire/rotate.
            revocation_options=RevocationOptions(enabled=False),
        )
        self._internal_client = internal_client

    def _get_resource_url(self, path: str | None = None) -> AnyHttpUrl | None:
        # The MCP app is mounted at `/api/mcp` with an internal path of "/", which would make the
        # advertised resource `.../api/mcp/`. Clients configured with `.../api/mcp` reject that.
        url = super()._get_resource_url(path)
        return AnyHttpUrl(str(url).rstrip("/")) if url else None

    # --- clients -----------------------------------------------------------------

    async def get_client(self, client_id: str) -> OAuthClientInformationFull | None:
        return await store_get("client", client_id, _ClientInformation)

    async def register_client(self, client_info: OAuthClientInformationFull) -> None:
        if client_info.client_id is None:
            raise ValueError("client_id is required")
        for uri in client_info.redirect_uris or []:
            if not _is_safe_redirect_uri(uri):
                raise RegistrationError(
                    error="invalid_redirect_uri",
                    error_description=f"Redirect URI not allowed: {uri}",
                )
        # The SDK's client_secret_basic check requires client_id in the form body as well, which
        # spec-compliant clients don't send. Steer clients to client_secret_post instead.
        if client_info.token_endpoint_auth_method == "client_secret_basic":
            client_info.token_endpoint_auth_method = "client_secret_post"
        await store_put("client", client_info.client_id, client_info, ttl=None)

    # --- authorization -----------------------------------------------------------

    async def authorize(self, client: OAuthClientInformationFull, params: AuthorizationParams) -> str:
        """Park the request and send the browser to InfraKitchen's login/consent page."""
        txn = secrets.token_urlsafe(32)
        await store_put(
            "pending",
            txn,
            PendingAuthorization(
                client_id=client.client_id or "",
                client_name=client.client_name,
                redirect_uri=params.redirect_uri,
                redirect_uri_provided_explicitly=params.redirect_uri_provided_explicitly,
                state=params.state,
                scopes=params.scopes or [],
                code_challenge=params.code_challenge,
                resource=params.resource,
            ),
            ttl=PENDING_TTL,
        )
        return f"{Settings().INFRAKITCHEN_URL.rstrip('/')}{CONSENT_PATH}?txn={txn}"

    async def load_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: str
    ) -> AuthorizationCode | None:
        code = await store_get("code", _hash(authorization_code), AuthorizationCode)
        if code is None or code.client_id != client.client_id:
            return None
        return code.model_copy(update={"code": authorization_code})

    async def exchange_authorization_code(
        self, client: OAuthClientInformationFull, authorization_code: AuthorizationCode
    ) -> OAuthToken:
        # Single use: delete before issuing tokens.
        code = await store_pop("code", _hash(authorization_code.code), AuthorizationCode)
        if code is None or code.subject is None:
            raise TokenError("invalid_grant", "Authorization code already used or expired")
        return await self._issue_tokens(code.client_id, code.subject, code.scopes, code.resource)

    # --- refresh tokens ----------------------------------------------------------

    async def load_refresh_token(self, client: OAuthClientInformationFull, refresh_token: str) -> RefreshToken | None:
        token = await store_get("refresh", _hash(refresh_token), RefreshToken)
        if token is None or token.client_id != client.client_id:
            return None
        return token.model_copy(update={"token": refresh_token})

    async def exchange_refresh_token(
        self, client: OAuthClientInformationFull, refresh_token: RefreshToken, scopes: list[str]
    ) -> OAuthToken:
        if not set(scopes).issubset(refresh_token.scopes):
            raise TokenError("invalid_scope", "Requested scopes exceed those originally granted")
        # Rotation: the old refresh token can only be used once.
        old = await store_pop("refresh", _hash(refresh_token.token), RefreshToken)
        if old is None or old.subject is None:
            raise TokenError("invalid_grant", "Refresh token already used or expired")
        if await _get_user(old.subject) is None:
            raise TokenError("invalid_grant", "User no longer active")
        return await self._issue_tokens(old.client_id, old.subject, scopes or old.scopes, old.resource)

    async def _issue_tokens(self, client_id: str, subject: str, scopes: list[str], resource: str | None) -> OAuthToken:
        now = datetime.now(UTC)
        access_token = jwt.encode(
            {
                "sub": subject,
                "client_id": client_id,
                "scope": " ".join(scopes),
                "aud": MCP_TOKEN_AUDIENCE,
                "iat": now,
                "exp": now + ACCESS_TOKEN_TTL,
            },
            key=_jwt_key(),
            algorithm="HS256",
        )
        refresh_value = secrets.token_urlsafe(48)
        await store_put(
            "refresh",
            _hash(refresh_value),
            RefreshToken(
                token="",  # never persist the raw value
                client_id=client_id,
                scopes=scopes,
                expires_at=int((now + REFRESH_TOKEN_TTL).timestamp()),
                resource=resource,
                subject=subject,
            ),
            ttl=REFRESH_TOKEN_TTL,
        )
        return OAuthToken(
            access_token=access_token,
            token_type="Bearer",
            expires_in=int(ACCESS_TOKEN_TTL.total_seconds()),
            refresh_token=refresh_value,
            scope=" ".join(scopes) or None,
        )

    async def create_authorization_code(self, txn: str, user_identifier: str, scopes: list[str] | None) -> str | None:
        """Called by the consent page once the user approved. Returns the client redirect URL.

        `scopes` is what the user picked; None means full access.
        """
        pending = await store_pop("pending", txn, PendingAuthorization)
        if pending is None:
            return None
        code_value = secrets.token_urlsafe(32)
        await store_put(
            "code",
            _hash(code_value),
            AuthorizationCode(
                code="",  # never persist the raw value
                scopes=[FULL_ACCESS_SCOPE] if scopes is None else scopes,
                expires_at=time.time() + AUTH_CODE_TTL.total_seconds(),
                client_id=pending.client_id,
                code_challenge=pending.code_challenge,
                redirect_uri=pending.redirect_uri,
                redirect_uri_provided_explicitly=pending.redirect_uri_provided_explicitly,
                resource=pending.resource,
                subject=user_identifier,
            ),
            ttl=AUTH_CODE_TTL,
        )
        return construct_redirect_uri(str(pending.redirect_uri), code=code_value, state=pending.state)

    async def deny_authorization(self, txn: str) -> str | None:
        pending = await store_pop("pending", txn, PendingAuthorization)
        if pending is None:
            return None
        return construct_redirect_uri(
            str(pending.redirect_uri),
            error="access_denied",
            error_description="User denied access",
            state=pending.state,
        )

    async def get_pending(self, txn: str) -> PendingAuthorization | None:
        return await store_get("pending", txn, PendingAuthorization)

    # --- access tokens -----------------------------------------------------------

    async def load_access_token(self, token: str) -> AccessToken | None:  # type: ignore[override]
        try:
            claims = jwt.decode(token, key=_jwt_key(), algorithms=["HS256"], audience=MCP_TOKEN_AUDIENCE)
        except jwt.InvalidTokenError:
            return await self._load_legacy_token(token)

        user = await _get_user(claims["sub"])
        if user is None:
            return None
        # MCP tools call the internal REST/GraphQL API, which only understands regular
        # InfraKitchen tokens; mint a short-lived one for this request.
        granted = claims.get("scope", "").split()
        forwarded = create_user_token(
            user, datetime.now(UTC) + FORWARDED_TOKEN_TTL, scopes=token_scopes_for_grant(granted)
        )
        return AccessToken(
            token=token,
            client_id=claims["client_id"],
            scopes=claims.get("scope", "").split() if claims.get("scope") else [],
            expires_at=claims["exp"],
            claims={**claims, "ik_authorization": f"Bearer {forwarded}"},
        )

    async def _load_legacy_token(self, token: str) -> AccessToken | None:
        """Session JWTs, personal access tokens and service-account tokens keep working."""
        header = f"Bearer {token}"
        try:
            probe = await self._internal_client.get(AUTH_PROBE_PATH, headers={"Authorization": header})
        except Exception:
            return None
        if not (200 <= probe.status_code < 300):
            return None
        return AccessToken(token=token, client_id="legacy", scopes=[], claims={"ik_authorization": header})

    async def revoke_token(self, token: AccessToken | RefreshToken) -> None:  # type: ignore[override]
        # Access tokens are short-lived JWTs; revoking the refresh token ends the grant.
        if isinstance(token, RefreshToken):
            await store_delete("refresh", _hash(token.token))
