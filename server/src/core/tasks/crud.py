from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import TaskEntity


class TaskEntityCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> TaskEntity | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(TaskEntity).where(TaskEntity.id == entity_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> TaskEntity | None:
        statement = select(TaskEntity)
        statement = evaluate_sqlalchemy_filters(TaskEntity, statement, filter)
        statement = evaluate_sqlalchemy_sorting(TaskEntity, statement, sort)

        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[TaskEntity]:
        statement = select(TaskEntity)
        statement = evaluate_sqlalchemy_filters(TaskEntity, statement, filter)
        statement = evaluate_sqlalchemy_sorting(TaskEntity, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(TaskEntity)
        statement = evaluate_sqlalchemy_filters(TaskEntity, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, task: dict[str, str | UUID | None]) -> TaskEntity:
        db_task = TaskEntity(**task)
        self.session.add(db_task)
        await self.session.flush()
        return db_task
