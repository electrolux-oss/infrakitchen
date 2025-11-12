from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Log


class LogCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> Log | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(Log).where(Log.id == entity_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Log]:
        statement = select(Log)
        statement = evaluate_sqlalchemy_filters(Log, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Log, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Log)
        statement = evaluate_sqlalchemy_filters(Log, statement, filter)
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
