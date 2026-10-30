from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .model import POOL_METADATA_KEY, Worker, worker_alive
from .query_options import build_worker_query_options


class WorkerCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        entity_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> Worker | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(Worker).where(Worker.id == entity_id)
        statement = statement.options(*build_worker_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Worker]:
        statement = select(Worker)
        statement = evaluate_sqlalchemy_filters(Worker, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Worker, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(*build_worker_query_options(fields))
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

    async def get_by_hosts(self, hosts: list[str]) -> list[Worker]:
        """Workers registered on ``hosts``, oldest update first."""
        if not hosts:
            return []
        statement = select(Worker).where(Worker.host.in_(hosts)).order_by(Worker.updated_at)
        return list((await self.session.execute(statement)).scalars().all())

    async def get_live_hosts(self, alive_since: datetime) -> set[str]:
        """Hosts with a worker that sent a heartbeat since ``alive_since`` and is not offline."""
        statement = select(Worker.host).where(worker_alive(alive_since))
        return set((await self.session.execute(statement)).scalars().all())

    async def get_hosts_with_prefix(self, prefix: str) -> set[str]:
        statement = select(Worker.host).where(Worker.host.startswith(prefix)).distinct()
        return set((await self.session.execute(statement)).scalars().all())

    async def delete_by_hosts(self, hosts: list[str]) -> int:
        if not hosts:
            return 0
        result = await self.session.execute(delete(Worker).where(Worker.host.in_(hosts)))
        return getattr(result, "rowcount", 0) or 0

    async def delete_gone(self, pool_id: str, keep_hosts: set[str], alive_since: datetime) -> int:
        statement = delete(Worker).where(
            Worker.host_metadata[POOL_METADATA_KEY].as_string() == pool_id,
            Worker.host.not_in(keep_hosts),
            ~worker_alive(alive_since),
        )
        result = await self.session.execute(statement)
        return getattr(result, "rowcount", 0) or 0

    async def mark_stale_offline(self, cutoff: datetime) -> int:
        result = await self.session.execute(
            update(Worker)
            .where(Worker.status != "offline", Worker.updated_at < cutoff)
            .values(status="offline")
            .execution_options(synchronize_session=False)
        )
        return getattr(result, "rowcount", 0) or 0

    async def commit(self) -> None:
        await self.session.commit()

    async def refresh(self, worker: Worker) -> None:
        await self.session.refresh(worker)
