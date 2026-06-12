import datetime
from typing import Literal
import jwt
from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import RedirectResponse

from core.errors import AccessUnauthorized, EntityExistsError
from core.sso.service import SSOService
from core.users.schema import UserCreateWithProvider

from .functions import create_user_token
from .dependencies import get_sso_service

from core.config import Settings

router = APIRouter()


async def guest_refresh_token(service: SSOService, request: Request, response: Response, cookie: str | None = None):
    guest_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "guest"})
    if len(guest_provider) == 0 or not guest_provider[0].enabled:
        raise AccessUnauthorized("Guest login is disabled")

    if not cookie:
        raise AccessUnauthorized("Missing cookie")

    JWT_KEY = Settings().JWT_KEY
    if not JWT_KEY:
        raise Exception("Missing JWT_KEY")

    try:
        decoded_token = jwt.decode(cookie, key=JWT_KEY, algorithms=["HS256"], audience="infrakitchen")
    except jwt.exceptions.InvalidTokenError as e:
        raise AccessUnauthorized("Invalid token") from e

    user = await service.user_service.get_user_by_identifier(decoded_token["pld"]["identifier"])

    if not user:
        raise AccessUnauthorized("Authentication failed")

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=int(Settings().SESSION_EXPIRATION))
    token = create_user_token(user, expiration)

    return {"token": token, "expiration": expiration}


@router.get("/guest/login/{scope}")
async def guest_login(scope: Literal["default", "super", "infra"], service: SSOService = Depends(get_sso_service)):
    guest_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "guest"})
    if len(guest_provider) == 0 or not guest_provider[0].enabled:
        raise AccessUnauthorized("Guest login is disabled")

    valid_scopes = ["default", "super", "infra"]
    if scope not in valid_scopes:
        raise ValueError("Invalid scope")

    response = RedirectResponse(url=f"/api/auth/guest/callback/{scope}")
    return response


@router.get("/guest/callback/{scope}")
async def guest_callback(scope: Literal["default", "super", "infra"], service: SSOService = Depends(get_sso_service)):
    guest_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "guest"})
    if len(guest_provider) == 0 or not guest_provider[0].enabled:
        raise AccessUnauthorized("Guest login is disabled")

    guest_user = UserCreateWithProvider(
        email=f"guest_{scope}@example.com",
        identifier=f"guest_{scope}",
        first_name=scope,
        last_name="User",
        provider="guest",
        display_name=f"Guest User {scope.capitalize()}",
    )

    user = await service.user_service.create_user_if_not_exists(guest_user)
    existing_roles = await service.casbin_enforcer.get_user_roles(user.id)
    reload_permission = False

    try:
        if scope not in existing_roles:
            _ = await service.permission_service.assign_user_to_role(scope, user.id, reload_permission=False)
            reload_permission = True
        if scope != "default" and "default" not in existing_roles:
            _ = await service.permission_service.assign_user_to_role("default", user.id, reload_permission=False)
            reload_permission = True

    except EntityExistsError:
        pass  # User is already assigned to the role

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)
    token = create_user_token(user, expiration)
    response = RedirectResponse(url="/")
    response.set_cookie(
        key="guest-token",
        value=token,
        httponly=True,
        secure=True,
        expires=datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30),
    )  # This cookie will make sure the user is authenticated
    user.updated_at = datetime.datetime.now(datetime.UTC)

    await service.audit_log_handler.create_log(
        entity_id=user.id,
        requester_id=user.id,
        action="login",
    )
    if reload_permission:
        await service.casbin_enforcer.send_reload_event()
    return response
