from fastapi import APIRouter, Security
from core.users import UserDTO
from core.sso.functions import get_logged_user

from .github import router as github
from .google import router as google
from .guest import router as guest
from .microsoft import router as microsoft
from .service_account import router as service_account

auth_router = APIRouter(prefix="/auth")


@auth_router.get("/me", response_model=UserDTO)
async def me(user: UserDTO = Security(get_logged_user)):
    return user


auth_router.include_router(
    microsoft,
    tags=["Auth"],
)

auth_router.include_router(
    guest,
    tags=["Auth"],
)

auth_router.include_router(
    service_account,
    tags=["Auth"],
)

auth_router.include_router(
    github,
    tags=["Auth"],
)

auth_router.include_router(
    google,
    tags=["Auth"],
)
