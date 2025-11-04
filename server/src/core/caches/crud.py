from typing import Any

from sqlalchemy import asc, desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.users.model import User

from core.database import evaluate_sqlalchemy_filters

from .model import Cache


class CacheCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh(self, instance: Cache) -> None:
        await self.session.refresh(instance)

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> Cache | None:
        statement = select(Cache)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Cache, query)
        if filters:
            statement = statement.where(*filters)
        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(User, field):
                sort_column = getattr(Cache, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        result = await self.session.execute(statement)
        return result.scalars().first()

    async def create(self, body: dict[str, Any]) -> Cache:
        db_cache = Cache(**body)
        self.session.add(db_cache)
        await self.session.flush()
        return db_cache

    async def delete(self, cache: Cache) -> None:
        await self.session.delete(cache)
