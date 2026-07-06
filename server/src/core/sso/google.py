import datetime

import httpx
import jwt
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from fastapi_sso.sso.google import GoogleSSO
from oauthlib.oauth2.rfc6749.errors import CustomOAuth2Error, InvalidGrantError

from core.config import Settings
from core.errors import AccessUnauthorized, EntityExistsError
from core.sso.service import SSOService
from core.users.schema import UserCreateWithProvider

from .dependencies import get_sso_service
from .functions import create_user_token
from ..auth_providers import GoogleProviderConfig

router = APIRouter()


async def get_google_sso(service: SSOService) -> GoogleSSO:
    google_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "google"})
    if len(google_providers) == 0 or not google_providers[0].enabled:
        raise AccessUnauthorized("Google login is disabled")

    google_provider = google_providers[0]

    if not isinstance(google_provider.configuration, GoogleProviderConfig):
        raise ValueError("Invalid Google provider configuration")

    GOOGLE_CLIENT_ID = google_provider.configuration.client_id
    GOOGLE_CLIENT_SECRET = google_provider.configuration.client_secret.get_decrypted_value()
    GOOGLE_REDIRECT_URI = google_provider.configuration.redirect_uri

    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI):
        raise ValueError("Google SSO not configured")

    return GoogleSSO(
        client_id=GOOGLE_CLIENT_ID,
        client_secret=GOOGLE_CLIENT_SECRET,
        redirect_uri=GOOGLE_REDIRECT_URI,
        scope=["openid", "email", "profile"],
    )


@router.get("/google/login")
async def google_login(service: SSOService = Depends(get_sso_service)):
    google_sso = await get_google_sso(service)
    async with google_sso:
        return await google_sso.get_login_redirect(params={"access_type": "offline", "prompt": "consent"})


async def google_refresh_token(
    service: SSOService,
    request: Request,
    response: Response,
    cookie: str | None = None,
):
    def get_user_email_from_id_token(id_token: str):
        decoded_token = jwt.decode(id_token, options={"verify_signature": False})
        return decoded_token.get("email")

    google_sso = await get_google_sso(service)

    token_endpoint = await google_sso.token_endpoint
    if not token_endpoint:
        raise Exception("token_endpoint is not defined")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_endpoint,
            data={
                "grant_type": "refresh_token",
                "client_id": google_sso.client_id,
                "client_secret": google_sso.client_secret,
                "refresh_token": cookie,
            },
            headers={"Accept": "application/json"},
        )

        resp_json = resp.json()

    if resp_json.get("error"):
        raise AccessUnauthorized(resp_json.get("error_description") or "Authentication failed")

    if "id_token" not in resp_json:
        raise AccessUnauthorized("Authentication failed")

    email = get_user_email_from_id_token(resp_json["id_token"])
    if not email:
        raise AccessUnauthorized("Authentication failed")

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=int(Settings().SESSION_EXPIRATION))

    user = await service.user_service.get_user_by_identifier(email.lower())

    if not user:
        raise AccessUnauthorized("Authentication failed")

    token = create_user_token(user, expiration)

    if "refresh_token" in resp_json:
        response.set_cookie(
            key="google-refresh-token",
            value=resp_json["refresh_token"],
            httponly=True,
            secure=True,
            expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
        )

    return {"token": token, "expiration": expiration}


@router.get("/google/callback")
async def google_callback(request: Request, service: SSOService = Depends(get_sso_service)):
    google_sso = await get_google_sso(service)
    try:
        async with google_sso:
            openid = await google_sso.verify_and_process(request)
            refresh_token = google_sso.refresh_token
    except InvalidGrantError as e:
        raise AccessUnauthorized(f"Authentication failed. {e}") from e
    except CustomOAuth2Error as e:
        raise AccessUnauthorized(f"Authentication failed. {e}") from e

    if not openid:
        raise AccessUnauthorized("Authentication failed")

    google_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "google"})
    if len(google_providers) == 0 or not google_providers[0].enabled:
        raise AccessUnauthorized("Google login is disabled")

    google_provider = google_providers[0]

    user_from_provider = openid.model_dump()
    if user_from_provider.get("id"):
        del user_from_provider["id"]

    if not user_from_provider.get("email"):
        raise AccessUnauthorized("Authentication failed. Email attribute is required")

    user_from_provider["email"] = user_from_provider["email"].lower()
    user_from_provider["identifier"] = user_from_provider["email"]
    if len(google_provider.filter_by_domain) > 0:
        if not any(user_from_provider["email"].endswith(f"@{domain}") for domain in google_provider.filter_by_domain):
            raise AccessUnauthorized("Authentication failed")

    if not refresh_token:
        raise Exception("Refresh token is required. Check your app configuration.")

    user = await service.user_service.create_user_if_not_exists(
        UserCreateWithProvider.model_validate(user_from_provider)
    )

    existing_roles = await service.casbin_enforcer.get_user_roles(user.id)
    reload_permission = False
    try:
        if "default" not in existing_roles:
            reload_permission = True
            _ = await service.permission_service.assign_user_to_role("default", user.id, reload_permission=False)
    except EntityExistsError:
        pass

    response = RedirectResponse(url="/")
    response.set_cookie(
        key="google-refresh-token",
        value=refresh_token,
        httponly=True,
        secure=True,
        expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
    )
    await service.audit_log_handler.create_log(
        entity_id=user.id,
        requester_id=user.id,
        action="login",
    )

    if reload_permission:
        await service.casbin_enforcer.send_reload_event()
    return response
