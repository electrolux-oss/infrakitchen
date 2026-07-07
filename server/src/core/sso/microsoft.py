import datetime
import os

import httpx
import jwt
from oauthlib.oauth2.rfc6749.errors import InvalidGrantError
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse
from fastapi_sso.sso.microsoft import MicrosoftSSO

from core.errors import AccessUnauthorized, EntityExistsError
from core.sso.service import SSOService
from core.users.schema import UserCreateWithProvider

from .functions import create_user_token
from .dependencies import get_sso_service


from ..auth_providers import MicrosoftProviderConfig

router = APIRouter()


async def get_microsoft_sso(service: SSOService) -> MicrosoftSSO:
    microsoft_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "microsoft"})
    if len(microsoft_providers) == 0 or not microsoft_providers[0].enabled:
        raise AccessUnauthorized("Microsoft login is disabled")

    microsoft_provider = microsoft_providers[0]

    assert isinstance(microsoft_provider.configuration, MicrosoftProviderConfig)

    MICROSOFT_CLIENT_ID = microsoft_provider.configuration.client_id
    MICROSOFT_CLIENT_SECRET = microsoft_provider.configuration.client_secret.get_decrypted_value()
    MICROSOFT_TENANT = microsoft_provider.configuration.tenant_id
    MICROSOFT_REDIRECT_URI = microsoft_provider.configuration.redirect_uri

    if not (MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET and MICROSOFT_TENANT and MICROSOFT_REDIRECT_URI):
        raise ValueError("Microsoft SSO not configured")

    return MicrosoftSSO(
        client_id=MICROSOFT_CLIENT_ID,
        client_secret=MICROSOFT_CLIENT_SECRET,
        tenant=MICROSOFT_TENANT,
        redirect_uri=MICROSOFT_REDIRECT_URI,
        scope=["openid", "User.Read", "email", "offline_access"],
    )


@router.get("/microsoft/login")
async def microsoft_login(service: SSOService = Depends(get_sso_service)):
    microsoft_sso = await get_microsoft_sso(service)
    async with microsoft_sso:
        return await microsoft_sso.get_login_redirect()


async def microsoft_refresh_token(service: SSOService, request: Request, response: Response, cookie: str | None = None):
    def get_user_email_from_access_token(access_token):
        decoded_token = jwt.decode(access_token, options={"verify_signature": False})
        return decoded_token.get("email")

    microsoft_sso = await get_microsoft_sso(service)

    token_endpoint = await microsoft_sso.token_endpoint
    if not token_endpoint:
        raise Exception("token_endpoint is not defined")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            token_endpoint,
            data={
                "grant_type": "refresh_token",
                "client_id": microsoft_sso.client_id,
                "client_secret": microsoft_sso.client_secret,
                "refresh_token": cookie,
                "scope": "openid offline_access",
            },
            headers={"Accept": "application/json"},
        )
        resp_json = resp.json()

    if resp_json.get("error"):
        raise AccessUnauthorized(resp_json.get("error_description") or "Authentication failed")

    if "access_token" not in resp_json:
        raise AccessUnauthorized("Authentication failed")

    # email is identifier for microsoft auth
    email = get_user_email_from_access_token(resp_json["access_token"])
    if not email:
        raise AccessUnauthorized("Authentication failed")

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(
        seconds=int(os.getenv("SESSION_EXPIRATION", 3600))
    )

    user = await service.user_service.get_user_by_identifier(email)

    if not user:
        raise AccessUnauthorized("Authentication failed")

    token = create_user_token(user, expiration)

    if "refresh_token" in resp_json:
        response.set_cookie(
            key="microsoft-refresh-token",
            value=resp_json["refresh_token"],
            httponly=True,
            secure=True,
            expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
        )

    return {"token": token, "expiration": expiration}


@router.get("/microsoft/callback")
async def microsoft_callback(
    request: Request,
    service: SSOService = Depends(get_sso_service),
):
    microsoft_sso: MicrosoftSSO = await get_microsoft_sso(service)

    try:
        async with microsoft_sso:
            openid = await microsoft_sso.verify_and_process(request)
            refresh_token = microsoft_sso.refresh_token
    except InvalidGrantError as e:
        raise AccessUnauthorized(f"Authentication failed. {e}") from e

    if not openid:
        raise AccessUnauthorized("Authentication failed")

    microsoft_providers = await service.auth_provider_service.get_all(filter={"auth_provider": "microsoft"})
    if len(microsoft_providers) == 0 or not microsoft_providers[0].enabled:
        raise AccessUnauthorized("Microsoft login is disabled")

    microsoft_provider = microsoft_providers[0]

    user_from_provider = openid.model_dump()
    if user_from_provider.get("id"):
        del user_from_provider["id"]

    if not user_from_provider.get("email"):
        raise AccessUnauthorized("Authentication failed. Email attribute is required")

    user_from_provider["email"] = user_from_provider["email"].lower()
    user_from_provider["identifier"] = user_from_provider["email"]
    if len(microsoft_provider.filter_by_domain) > 0:
        if not any(
            user_from_provider["email"].endswith(f"@{domain}") for domain in microsoft_provider.filter_by_domain
        ):
            raise AccessUnauthorized("Authentication failed")

    user = await service.user_service.create_user_if_not_exists(UserCreateWithProvider(**user_from_provider))
    existing_roles = await service.casbin_enforcer.get_user_roles(user.id)
    reload_permission = False

    try:
        if "default" not in existing_roles:
            _ = await service.permission_service.assign_user_to_role("default", user.id, reload_permission=False)
            reload_permission = True
    except EntityExistsError:
        pass  # User is already assigned to the role

    if not refresh_token:
        raise Exception("Refresh token is required. Check your app configuration.")

    response = RedirectResponse(url="/")
    response.set_cookie(
        key="microsoft-refresh-token",
        value=refresh_token,
        httponly=True,
        secure=True,
        expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
    )  # This cookie will make sure the user is authenticated
    await service.audit_log_handler.create_log(
        entity_id=user.id,
        requester_id=user.id,
        action="login",
    )
    if reload_permission:
        await service.casbin_enforcer.send_reload_event()
    return response
