from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters

from .model import Favorite, FavoriteComponentType


class FavoriteCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self, user_id: UUID | str, component_type: FavoriteComponentType, component_id: UUID | str
    ) -> Favorite | None:
        """Get a favorite by composite key (user_id, component_type, component_id)."""
        statement = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.component_type == component_type,
            Favorite.component_id == component_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all_by_user_id(self, user_id: UUID | str) -> list[Favorite]:
        """Get all favorites for a user."""
        statement = select(Favorite).where(Favorite.user_id == user_id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        """Count favorites with optional filter."""
        statement = select(func.count()).select_from(Favorite)
        statement = evaluate_sqlalchemy_filters(Favorite, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Favorite:
        """Create a new favorite."""
        db_favorite = Favorite(**body)
        self.session.add(db_favorite)
        await self.session.flush()
        return db_favorite

    async def delete(self, favorite: Favorite) -> None:
        """Delete a favorite."""
        await self.session.delete(favorite)

    async def delete_all_by_component(self, component_type: FavoriteComponentType, component_id: UUID | str) -> None:
        """Delete all favorites for a specific component."""
        statement = delete(Favorite).where(
            Favorite.component_type == component_type,
            Favorite.component_id == component_id,
        )
        await self.session.execute(statement)

    async def refresh(self, favorite: Favorite) -> None:
        """Refresh favorite object from database."""
        await self.session.refresh(favorite)
