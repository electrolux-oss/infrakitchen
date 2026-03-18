from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session

from .crud import FavoriteCRUD
from .service import FavoriteService


def get_favorite_service(session: AsyncSession = Depends(get_db_session)) -> FavoriteService:
    """FastAPI dependency that provides a FavoriteService instance."""
    return FavoriteService(crud=FavoriteCRUD(session=session))
