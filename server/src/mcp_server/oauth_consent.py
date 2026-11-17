"""Browser-facing login + consent step of the MCP OAuth flow."""

import hmac
import logging
import secrets
from hashlib import sha256
from typing import Literal
from urllib.parse import urlencode

import jwt
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel

from core.config import Settings
from core.errors import AccessUnauthorized
from core.personal_access_tokens.schema import validate_scopes
from core.sso.dependencies import get_sso_service
from core.sso.github import github_refresh_token
from core.sso.google import google_refresh_token
from core.sso.guest import guest_refresh_token
from core.sso.microsoft import microsoft_refresh_token
from core.sso.return_to import RETURN_TO_COOKIE
from core.sso.service import SSOService

from .oauth_provider import CONSENT_PATH, InfraKitchenOAuthProvider


CONSENT_NONCE_COOKIE = "ik-mcp-consent"
NONCE_PATH = "/api/mcp-oauth/requests/"
CONSENT_UI_PATH = "/mcp-oauth/consent"

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/mcp-oauth", tags=["MCP OAuth"])

_provider: InfraKitchenOAuthProvider | None = None


def set_oauth_provider(provider: InfraKitchenOAuthProvider | None) -> None:
    global _provider
    _provider = provider


def _get_provider() -> InfraKitchenOAuthProvider:
    if _provider is None:
        raise AccessUnauthorized("MCP OAuth is not enabled")
    return _provider


async def _current_user_identifier(request: Request, service: SSOService, response: Response) -> str | None:
    """Resolve the signed-in user from the SSO refresh cookies.

    Refreshing may rotate the provider's refresh cookie; those Set-Cookie headers land on
    `response` and must be copied onto whatever response is finally returned.
    """
    refreshers = [
        ("microsoft-refresh-token", microsoft_refresh_token),
        ("guest-token", guest_refresh_token),
        ("github-refresh-token", github_refresh_token),
        ("google-refresh-token", google_refresh_token),
    ]
    for cookie_name, refresh in refreshers:
        cookie = request.cookies.get(cookie_name)
        if not cookie:
            continue
        try:
            result = await refresh(service, request, response, cookie=cookie)
            claims = jwt.decode(
                str(result["token"]), key=Settings().JWT_KEY, algorithms=["HS256"], audience="infrakitchen"
            )
            return claims["pld"]["identifier"]
        except Exception:
            return None
    return None


def _copy_cookies(src: Response, dst: Response) -> Response:
    for name, value in src.raw_headers:
        if name.lower() == b"set-cookie":
            dst.raw_headers.append((name, value))
    return dst


def _csrf(txn: str, nonce: str, identifier: str) -> str:
    """Bound to the transaction, this browser (nonce cookie) and the user who saw the page."""
    message = f"mcp-consent:{txn}:{nonce}:{identifier}".encode()
    return hmac.new(Settings().JWT_KEY.encode(), message, sha256).hexdigest()


def _same_origin(request: Request) -> bool:
    origin = request.headers.get("origin")
    if origin is None or origin == "null":
        # Browsers send no Origin, or the opaque "null", after redirect chains like this login flow.
        # Fall back to Fetch Metadata; the SameSite=Strict nonce cookie + CSRF token still apply.
        return request.headers.get("sec-fetch-site", "same-origin") in ("same-origin", "same-site", "none")
    expected = Settings().INFRAKITCHEN_URL.rstrip("/")
    return origin.rstrip("/") == expected


class ConsentDecision(BaseModel):
    csrf: str
    decision: Literal["allow", "deny"]
    # None = full access (same permissions as the user); otherwise "<read|write>:<entity>" entries.
    scopes: list[str] | None = None


def _expired() -> JSONResponse:
    return JSONResponse({"detail": "This authorization request has expired. Please try again from your client."}, 404)


@router.get("/consent")
async def consent_entry(request: Request, txn: str, service: SSOService = Depends(get_sso_service)):
    """Entry point from /authorize: make sure the user is signed in, then hand over to the UI."""
    cookies = Response()
    identifier = await _current_user_identifier(request, service, cookies)
    if identifier is None:
        response = RedirectResponse(url="/")
        response.set_cookie(
            RETURN_TO_COOKIE, f"{CONSENT_PATH}?txn={txn}", max_age=600, httponly=True, secure=True, samesite="lax"
        )
        return response
    return _copy_cookies(cookies, RedirectResponse(url=f"{CONSENT_UI_PATH}?{urlencode({'txn': txn})}"))


@router.get("/requests/{txn}")
async def get_consent_request(request: Request, txn: str, service: SSOService = Depends(get_sso_service)):
    provider = _get_provider()
    cookies = Response()
    identifier = await _current_user_identifier(request, service, cookies)
    if identifier is None:
        return _copy_cookies(cookies, JSONResponse({"detail": "Not signed in"}, 401))

    pending = await provider.get_pending(txn)
    if pending is None:
        return _copy_cookies(cookies, _expired())

    nonce = secrets.token_urlsafe(32)
    response = JSONResponse(
        {
            "client_name": pending.client_name or pending.client_id,
            "redirect_host": pending.redirect_uri.host or str(pending.redirect_uri),
            "user": identifier,
            "requested_scopes": pending.scopes,
            "csrf": _csrf(txn, nonce, identifier),
        },
        headers={"Cache-Control": "no-store"},
    )
    response.set_cookie(
        CONSENT_NONCE_COOKIE, nonce, max_age=600, path=NONCE_PATH, httponly=True, secure=True, samesite="strict"
    )
    return _copy_cookies(cookies, response)


@router.post("/requests/{txn}")
async def submit_consent(
    request: Request, txn: str, body: ConsentDecision, service: SSOService = Depends(get_sso_service)
):
    provider = _get_provider()
    cookies = Response()
    identifier = await _current_user_identifier(request, service, cookies)
    if identifier is None:
        return _copy_cookies(cookies, JSONResponse({"detail": "Not signed in"}, 401))

    nonce = request.cookies.get(CONSENT_NONCE_COOKIE, "")
    reason = None
    if not _same_origin(request):
        reason = f"origin mismatch: {request.headers.get('origin')!r}"
    elif not nonce:
        reason = "missing consent nonce cookie"
    elif not hmac.compare_digest(body.csrf, _csrf(txn, nonce, identifier)):
        reason = "csrf token mismatch"
    if reason:
        logger.warning("MCP OAuth consent rejected: %s", reason)
        return _copy_cookies(cookies, JSONResponse({"detail": "Invalid request"}, 400))

    if body.decision == "allow":
        try:
            scopes = validate_scopes(body.scopes)
        except ValueError as e:
            return _copy_cookies(cookies, JSONResponse({"detail": str(e)}, 400))
        target = await provider.create_authorization_code(txn, identifier, scopes)
    else:
        target = await provider.deny_authorization(txn)

    response = _expired() if target is None else JSONResponse({"redirect_url": target})
    response.delete_cookie(CONSENT_NONCE_COOKIE, path=NONCE_PATH)
    return _copy_cookies(cookies, response)
