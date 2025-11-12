from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_sorting

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
        statement = evaluate_sqlalchemy_filters(Cache, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Cache, statement, sort)
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def create(self, body: dict[str, Any]) -> Cache:
        db_cache = Cache(**body)
        self.session.add(db_cache)
        await self.session.flush()
        return db_cache

    async def delete(self, cache: Cache) -> None:
        await self.session.delete(cache)
