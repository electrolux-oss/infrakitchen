import datetime
from typing import Literal
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse

from core.sso.service import SSOService
from core.users.schema import UserCreateWithProvider

from .functions import create_user_token
from .dependencies import get_sso_service

from core.config import Settings

router = APIRouter()


async def guest_refresh_token(service: SSOService, request: Request, response: Response, cookie: str | None = None):
    guest_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "guest"})
    if len(guest_provider) == 0 or not guest_provider[0].enabled:
        raise HTTPException(status_code=401, detail="Guest login is disabled")

    if not cookie:
        raise HTTPException(status_code=401, detail="Missing cookie")

    JWT_KEY = Settings().JWT_KEY
    if not JWT_KEY:
        raise HTTPException(status_code=500, detail="Missing JWT_KEY")

    try:
        decoded_token = jwt.decode(cookie, key=JWT_KEY, algorithms=["HS256"], audience="infrakitchen")
    except jwt.exceptions.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail="Invalid token") from e

    user = await service.user_service.get_user_by_identifier(decoded_token["pld"]["identifier"])

    if not user:
        raise HTTPException(status_code=401, detail="Authentication failed")

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(seconds=int(Settings().SESSION_EXPIRATION))
    token = create_user_token(user, expiration)

    return {"token": token, "expiration": expiration}


@router.get("/guest/login/{scope}")
async def guest_login(scope: Literal["default", "super", "infra"], service: SSOService = Depends(get_sso_service)):
    guest_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "guest"})
    if len(guest_provider) == 0 or not guest_provider[0].enabled:
        raise HTTPException(status_code=401, detail="Guest login is disabled")

    valid_scopes = ["default", "super", "infra"]
    if scope not in valid_scopes:
        raise HTTPException(status_code=400, detail="Invalid scope")

    response = RedirectResponse(url=f"/api/auth/guest/callback/{scope}")
    return response


@router.get("/guest/callback/{scope}")
async def guest_callback(scope: Literal["default", "super", "infra"], service: SSOService = Depends(get_sso_service)):
    guest_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "guest"})
    if len(guest_provider) == 0 or not guest_provider[0].enabled:
        raise HTTPException(status_code=401, detail="Guest login is disabled")

    guest_user = UserCreateWithProvider(
        email=f"guest_{scope}@example.com",
        identifier=f"guest_{scope}",
        first_name=scope,
        last_name="User",
        provider="guest",
        display_name=f"Guest User {scope.capitalize()}",
    )

    user = await service.user_service.create_user_if_not_exists(guest_user)
    _ = await service.casbin_enforcer.add_casbin_user_role(user.id, scope)
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
    assert user.id is not None, "User ID should not be None"
    await service.audit_log_handler.create_log(
        entity_id=user.id,
        requester_id=user.id,
        action="login",
    )
    return response
