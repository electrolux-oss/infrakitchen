import datetime
from typing import Any
from fastapi import APIRouter, Body, Depends, HTTPException

from core.sso.service import SSOService
from .functions import create_user_token
from .dependencies import get_sso_service

from ..utils.password_manager import is_correct_password

router = APIRouter()


@router.post("/service_account/token")
async def service_account_token(body: dict[str, Any] = Body(...), service: SSOService = Depends(get_sso_service)):
    ik_sa_provider = await service.auth_provider_service.get_all(filter={"auth_provider": "ik_service_account"})
    if len(ik_sa_provider) == 0 or not ik_sa_provider[0].enabled:
        raise HTTPException(status_code=401, detail="Service Account login is disabled")

    if body.get("identifier") is None and body.get("password") is None:
        raise HTTPException(status_code=400, detail="identifier and password are required")

    user = await service.user_service.get_user_by_identifier(body["identifier"])

    if not user:
        raise HTTPException(status_code=401, detail="Invalid password or username")

    if not user.password:
        raise HTTPException(status_code=401, detail="Invalid password or username")

    salt, hashed_password = user.password.get_decrypted_value().split("$")
    if not is_correct_password(salt, hashed_password, body["password"]):
        raise HTTPException(status_code=401, detail="Invalid password or username")

    expiration = datetime.datetime.now(datetime.UTC) + datetime.timedelta(days=30)
    token = create_user_token(user, expiration)
    return {"token": token, "expires_at": expiration}
