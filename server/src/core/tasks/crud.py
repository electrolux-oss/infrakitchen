from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters

from .model import TaskEntity


class TaskEntityCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> TaskEntity | None:
        statement = select(TaskEntity).where(TaskEntity.id == entity_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> TaskEntity | None:
        statement = select(TaskEntity)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(TaskEntity, query)
        if filters:
            statement = statement.where(*filters)
        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(TaskEntity, field):
                sort_column = getattr(TaskEntity, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[TaskEntity]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(TaskEntity, query)
        statement = select(TaskEntity)
        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(TaskEntity, field):
                sort_column = getattr(TaskEntity, field)
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
        statement = select(func.count()).select_from(TaskEntity)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(TaskEntity, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, task: dict[str, str | UUID | None]) -> TaskEntity:
        db_task = TaskEntity(**task)
        self.session.add(db_task)
        await self.session.flush()
        return db_task
