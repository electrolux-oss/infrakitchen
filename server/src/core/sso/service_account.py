import datetime
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException, Request
from starlette.requests import HTTPConnection

from core.errors import AccessUnauthorized
from core.sso.service import SSOService
from core.users.model import UserDTO
from .functions import create_user_token
from .dependencies import get_sso_service

from ..utils.password_manager import burn_password_check, is_correct_password_async
from ..utils.rate_limiter import SlidingWindowLimiter

router = APIRouter()

# Login is unauthenticated and runs PBKDF2, so cap both guessing and CPU use.
# Behind a reverse proxy, run uvicorn with --proxy-headers so client.host is the real client.
_attempts_per_client = SlidingWindowLimiter(max_hits=30, window_seconds=60)
_failures_per_identifier = SlidingWindowLimiter(max_hits=10, window_seconds=300)


async def authenticate_service_account(
    service: SSOService, connection: HTTPConnection | None, identifier: str | None, password: str | None
) -> UserDTO:
    ik_sa_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "ik_service_account"})
    if len(ik_sa_provider) == 0 or not ik_sa_provider[0].enabled:
        raise AccessUnauthorized("Service Account login is disabled")

    if not identifier or not password:
        raise ValueError("identifier and password are required")

    client_key = connection.client.host if connection is not None and connection.client else "unknown"
    if _attempts_per_client.is_limited(client_key) or _failures_per_identifier.is_limited(identifier):
        raise AccessUnauthorized("Too many login attempts. Try again later")
    _attempts_per_client.hit(client_key)

    user = await service.user_service.get_user_by_identifier(identifier)

    if not user or not user.password:
        await burn_password_check(password)
        _failures_per_identifier.hit(identifier)
        raise AccessUnauthorized("Invalid password or username")

    salt, hashed_password = user.password.get_decrypted_value().split("$", maxsplit=1)
    if not await is_correct_password_async(salt, hashed_password, password):
        _failures_per_identifier.hit(identifier)
        raise AccessUnauthorized("Invalid password or username")

    _failures_per_identifier.reset(identifier)
    return user


@router.post("/service_account/token")
async def service_account_token(
    request: Request, body: dict[str, Any] = Body(...), service: SSOService = Depends(get_sso_service)
):
    try:
        user = await authenticate_service_account(service, request, body.get("identifier"), body.get("password"))
    except AccessUnauthorized as e:
        raise HTTPException(status_code=401, detail=str(e)) from e
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)
    token = create_user_token(user, expiration)
    return {"token": token, "expires_at": expiration}
