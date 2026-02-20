from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import SessionLocal

from .crud import FavoriteCRUD
from .service import FavoriteService


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_favorite_service(session: AsyncSession = Depends(get_db_session)) -> FavoriteService:
    """FastAPI dependency that provides a FavoriteService instance."""
    return FavoriteService(crud=FavoriteCRUD(session=session))
