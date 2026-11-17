"""Browser-facing login + consent step of the MCP OAuth flow."""

import hmac
import logging
import secrets
from hashlib import sha256
from html import escape

import jwt
from fastapi import APIRouter, Depends, Form, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse

from core.config import Settings
from core.errors import AccessUnauthorized
from core.sso.dependencies import get_sso_service
from core.sso.github import github_refresh_token
from core.sso.google import google_refresh_token
from core.sso.guest import guest_refresh_token
from core.sso.microsoft import microsoft_refresh_token
from core.sso.return_to import RETURN_TO_COOKIE
from core.sso.service import SSOService

from .oauth_provider import CONSENT_PATH, InfraKitchenOAuthProvider


CONSENT_NONCE_COOKIE = "ik-mcp-consent"

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


def _page(body: str, status_code: int = 200) -> HTMLResponse:
    html = f"""<!doctype html><html><head><meta charset="utf-8"><title>InfraKitchen</title>
<style>body{{font-family:system-ui,sans-serif;max-width:28rem;margin:4rem auto;padding:0 1rem}}
button{{padding:.5rem 1.2rem;margin-right:.5rem;cursor:pointer}}code{{word-break:break-all}}</style>
</head><body>{body}</body></html>"""
    return HTMLResponse(
        html,
        status_code=status_code,
        headers={"X-Frame-Options": "DENY", "Content-Security-Policy": "frame-ancestors 'none'"},
    )


@router.get("/consent")
async def consent_page(request: Request, txn: str, service: SSOService = Depends(get_sso_service)):
    provider = _get_provider()
    pending = await provider.get_pending(txn)
    if pending is None:
        return _page("<h2>This authorization request has expired.</h2><p>Please try again from your client.</p>", 400)

    cookies = Response()
    identifier = await _current_user_identifier(request, service, cookies)
    if identifier is None:
        response = RedirectResponse(url="/")
        response.set_cookie(
            RETURN_TO_COOKIE, f"{CONSENT_PATH}?txn={txn}", max_age=600, httponly=True, secure=True, samesite="lax"
        )
        return response

    nonce = secrets.token_urlsafe(32)
    client_name = escape(pending.client_name or pending.client_id)
    redirect_host = escape(pending.redirect_uri.host or str(pending.redirect_uri))
    page = _page(f"""
<h2>Authorize {client_name}</h2>
<p><b>{client_name}</b> wants to access InfraKitchen as <b>{escape(identifier)}</b>
via MCP, with the same permissions you have.</p>
<p>You will be redirected to <code>{redirect_host}</code>.</p>
<form method="post" action="{CONSENT_PATH}">
  <input type="hidden" name="txn" value="{escape(txn)}">
  <input type="hidden" name="csrf" value="{_csrf(txn, nonce, identifier)}">
  <button type="submit" name="decision" value="allow">Allow</button>
  <button type="submit" name="decision" value="deny">Deny</button>
</form>""")
    page.set_cookie(
        CONSENT_NONCE_COOKIE, nonce, max_age=600, path=CONSENT_PATH, httponly=True, secure=True, samesite="strict"
    )
    return _copy_cookies(cookies, page)


@router.post("/consent")
async def consent_submit(
    request: Request,
    txn: str = Form(...),
    csrf: str = Form(...),
    decision: str = Form(...),
    service: SSOService = Depends(get_sso_service),
):
    provider = _get_provider()
    cookies = Response()
    identifier = await _current_user_identifier(request, service, cookies)
    if identifier is None:
        return _copy_cookies(cookies, _page("<h2>You are not signed in.</h2>", 401))

    nonce = request.cookies.get(CONSENT_NONCE_COOKIE, "")
    reason = None
    if not _same_origin(request):
        reason = f"origin mismatch: {request.headers.get('origin')!r}"
    elif not nonce:
        reason = "missing consent nonce cookie"
    elif not hmac.compare_digest(csrf, _csrf(txn, nonce, identifier)):
        reason = "csrf token mismatch"
    if reason:
        logger.warning("MCP OAuth consent rejected: %s", reason)
        return _copy_cookies(cookies, _page("<h2>Invalid request.</h2>", 400))

    if decision == "allow":
        target = await provider.create_authorization_code(txn, identifier)
    else:
        target = await provider.deny_authorization(txn)

    if target is None:
        response: Response = _page(
            "<h2>This authorization request has expired.</h2><p>Please try again from your client.</p>", 400
        )
    else:
        response = RedirectResponse(url=target, status_code=303)
    response.delete_cookie(CONSENT_NONCE_COOKIE, path=CONSENT_PATH)
    return _copy_cookies(cookies, response)
