from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.expression import select

from core.errors import EntityNotFound

from .model import Favorite, FavoriteComponentType, FavoriteCreate, FavoriteDTO


class FavoriteService:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_all_by_user_id(self, user_id: UUID | str) -> list[FavoriteDTO]:
        statement = select(Favorite).where(Favorite.user_id == user_id)
        result = await self.session.execute(statement)
        favorites = result.scalars().all()
        return [FavoriteDTO.model_validate(favorite) for favorite in favorites]

    async def create(self, favorite: FavoriteCreate, user_id: UUID | str) -> FavoriteDTO:
        existing = await self.get_by_composite_keys(
            user_id=user_id,
            component_type=favorite.component_type,
            component_id=favorite.component_id,
        )

        if existing:
            return FavoriteDTO.model_validate(existing)

        db_favorite = Favorite(
            user_id=user_id,
            component_type=favorite.component_type,
            component_id=favorite.component_id,
        )

        self.session.add(db_favorite)
        await self.session.flush()
        await self.session.refresh(db_favorite)
        return FavoriteDTO.model_validate(db_favorite)

    async def delete(
        self, user_id: UUID | str, component_type: FavoriteComponentType, component_id: UUID | str
    ) -> None:
        favorite = await self.get_by_composite_keys(
            user_id=user_id,
            component_type=component_type,
            component_id=component_id,
        )

        if not favorite:
            raise EntityNotFound("Favorite not found")

        await self.session.delete(favorite)

    async def get_by_composite_keys(
        self,
        user_id: UUID | str,
        component_type: FavoriteComponentType,
        component_id: UUID | str,
    ) -> Favorite | None:
        statement = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.component_type == component_type,
            Favorite.component_id == component_id,
        )

        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def delete_all_by_component(self, component_type: FavoriteComponentType, component_id: UUID | str) -> None:
        statement = delete(Favorite).where(
            Favorite.component_type == component_type,
            Favorite.component_id == component_id,
        )
        await self.session.execute(statement)
