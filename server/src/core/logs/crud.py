from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters

from .model import Log


class LogCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> Log | None:
        statement = select(Log).where(Log.id == entity_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Log]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Log, query)
        statement = select(Log)
        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(Log, field):
                sort_column = getattr(Log, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        # Apply pagination
        if range:
            skip, end = range
            limit = end - skip
            statement = statement.offset(skip).limit(limit)
        else:
            statement = statement.limit(100)  # default limit

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Log)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Log, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_logs_execution_time(self, entity_id: str, trace_id: str | None = None) -> list[Log]:
        """
        Execution time logs for a specific entity.
        """
        if trace_id:
            statement = select(Log).where(
                Log.entity_id == entity_id,
                Log.level == "header",
                Log.trace_id == trace_id,
            )
        else:
            statement = select(Log).where(
                Log.entity_id == entity_id,
                Log.level == "header",
            )
        result = await self.session.execute(statement)
        return list(result.scalars().all())
