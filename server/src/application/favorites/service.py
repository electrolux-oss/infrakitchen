from typing import Any
from uuid import UUID

from core.errors import EntityNotFound

from .crud import FavoriteCRUD
from .model import FavoriteComponentType, FavoriteDTO
from .schema import FavoriteCreate


class FavoriteService:
    """
    FavoriteService implements all business-logic for favorites.
    It uses FavoriteCRUD for database operations.
    """

    def __init__(self, crud: FavoriteCRUD):
        self.crud: FavoriteCRUD = crud

    async def get_by_id(
        self, user_id: UUID | str, component_type: FavoriteComponentType, component_id: UUID | str
    ) -> FavoriteDTO | None:
        """Get a favorite by composite key."""
        favorite = await self.crud.get_by_id(user_id, component_type, component_id)
        if favorite is None:
            return None
        return FavoriteDTO.model_validate(favorite)

    async def get_all_by_user_id(self, user_id: UUID | str) -> list[FavoriteDTO]:
        """Get all favorites for a user."""
        favorites = await self.crud.get_all_by_user_id(user_id)
        return [FavoriteDTO.model_validate(favorite) for favorite in favorites]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        """Count favorites with optional filter."""
        return await self.crud.count(filter=filter)

    async def create(self, favorite: FavoriteCreate, user_id: UUID | str) -> FavoriteDTO:
        """Create a new favorite (or return existing if already favorited)."""
        existing = await self.crud.get_by_id(
            user_id=user_id,
            component_type=favorite.component_type,
            component_id=favorite.component_id,
        )

        if existing:
            return FavoriteDTO.model_validate(existing)

        body = favorite.model_dump()
        body["user_id"] = user_id
        db_favorite = await self.crud.create(body)
        await self.crud.refresh(db_favorite)
        return FavoriteDTO.model_validate(db_favorite)

    async def delete(
        self, user_id: UUID | str, component_type: FavoriteComponentType, component_id: UUID | str
    ) -> None:
        """Delete a favorite by composite key."""
        favorite = await self.crud.get_by_id(user_id, component_type, component_id)

        if not favorite:
            raise EntityNotFound("Favorite not found")

        await self.crud.delete(favorite)

    async def delete_all_by_component(self, component_type: FavoriteComponentType, component_id: UUID | str) -> None:
        """Delete all favorites for a specific component (used on component deletion)."""
        await self.crud.delete_all_by_component(component_type, component_id)
