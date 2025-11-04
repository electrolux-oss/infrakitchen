from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters

from .model import Worker


class WorkerCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID) -> Worker | None:
        statement = select(Worker).where(Worker.id == entity_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Worker]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Worker, query)
        statement = select(Worker)
        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(Worker, field):
                sort_column = getattr(Worker, field)
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
        statement = select(func.count()).select_from(Worker)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Worker, query)
        if filters:
            statement = statement.where(*filters)

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
