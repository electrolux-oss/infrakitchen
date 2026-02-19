from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import SessionLocal
from core.users.model import UserDTO

from .model import FavoriteComponentType, FavoriteCreate, FavoriteDTO
from .service import FavoriteService

router = APIRouter()


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_favorite_service(session: AsyncSession = Depends(get_db_session)) -> FavoriteService:
    return FavoriteService(session=session)


@router.get(
    "/favorites",
    response_model=list[FavoriteDTO],
    response_description="Get all favorites for the current user",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(request: Request, service: FavoriteService = Depends(get_favorite_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.get_all_by_user_id(user_id=requester.id)


@router.post(
    "/favorites",
    response_model=FavoriteDTO,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request,
    body: FavoriteCreate,
    service: FavoriteService = Depends(get_favorite_service),
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.create(favorite=body, user_id=requester.id)


@router.delete(
    "/favorites/{component_type}/{component_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
async def delete(
    request: Request,
    component_type: FavoriteComponentType,
    component_id: UUID,
    service: FavoriteService = Depends(get_favorite_service),
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(user_id=requester.id, component_type=component_type, component_id=component_id)
