from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Worker


class WorkerCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> Worker | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(Worker).where(Worker.id == entity_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Worker]:
        statement = select(Worker)
        statement = evaluate_sqlalchemy_filters(Worker, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Worker, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Worker)
        statement = evaluate_sqlalchemy_filters(Worker, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Worker:
        db_worker = Worker(**body)
        self.session.add(db_worker)
        await self.session.flush()
        return db_worker

    async def update(self, existing_worker: Worker, body: dict[str, Any]) -> Worker:
        for key, value in body.items():
            setattr(existing_worker, key, value)

        return existing_worker

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh(self, worker: Worker) -> None:
        await self.session.refresh(worker)
