from collections.abc import AsyncGenerator
from fastapi import APIRouter, Depends, HTTPException, Request, Response, Security
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import SessionLocal
from core.sso.dependencies import get_sso_service
from core.sso.service import SSOService

from ..users import UserDTO
from core.sso.functions import get_logged_user

from .github import github_refresh_token
from .github import router as github
from .guest import guest_refresh_token
from .guest import router as guest
from .microsoft import microsoft_refresh_token
from .microsoft import router as microsoft
from .service_account import router as service_account

auth_router = APIRouter(prefix="/auth")


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


@auth_router.get("/me", response_model=UserDTO)
async def me(user: UserDTO = Security(get_logged_user)):
    return user


@auth_router.get("/refresh")
async def refresh_token(request: Request, response: Response, service: SSOService = Depends(get_sso_service)):
    refresh_token = request.cookies.get("microsoft-refresh-token")
    if refresh_token:
        return await microsoft_refresh_token(service, request, response, cookie=refresh_token)

    guest_token = request.cookies.get("guest-token")

    if guest_token:
        return await guest_refresh_token(service, request, response, cookie=guest_token)

    github_token = request.cookies.get("github-refresh-token")

    if github_token:
        return await github_refresh_token(service, request, response, cookie=github_token)

    raise HTTPException(status_code=401, detail="Authentication failed")


@auth_router.get("/logout")
async def guest_logout():
    response = RedirectResponse(url="/")

    def delete_all_cookies(response: RedirectResponse):
        cookie_names = ["microsoft-refresh-token", "guest-token", "github-refresh-token", "token"]

        for cookie_name in cookie_names:
            response.delete_cookie(key=cookie_name, httponly=True, secure=True)

        return response

    return delete_all_cookies(response)


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
