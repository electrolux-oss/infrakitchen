from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid
from core.workers.model import Worker

from .model import WorkerTemplate
from .query_options import build_worker_template_query_options


class WorkerTemplateCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        worker_template_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> WorkerTemplate | None:
        if not is_valid_uuid(worker_template_id):
            raise ValueError(f"Invalid UUID: {worker_template_id}")

        statement = select(WorkerTemplate).where(WorkerTemplate.id == worker_template_id)
        statement = statement.options(*build_worker_template_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[WorkerTemplate]:
        statement = select(WorkerTemplate)
        statement = evaluate_sqlalchemy_filters(WorkerTemplate, statement, filter)
        statement = evaluate_sqlalchemy_sorting(WorkerTemplate, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(*build_worker_template_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(WorkerTemplate)
        statement = evaluate_sqlalchemy_filters(WorkerTemplate, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_workers_by_host(self, hosts: list[str]) -> list[Worker]:
        """Registered workers running on ``hosts``, oldest update first."""
        statement = select(Worker).where(Worker.host.in_(hosts)).order_by(Worker.updated_at)
        return list((await self.session.execute(statement)).scalars().all())

    async def delete_workers_by_host(self, hosts: list[str]) -> None:
        if hosts:
            _ = await self.session.execute(delete(Worker).where(Worker.host.in_(hosts)))

    async def create(self, body: dict[str, Any]) -> WorkerTemplate:
        db_worker_template = WorkerTemplate(**body)
        self.session.add(db_worker_template)
        await self.session.flush()
        return db_worker_template

    async def update(self, existing_worker_template: WorkerTemplate, body: dict[str, Any]) -> WorkerTemplate:
        for key, value in body.items():
            setattr(existing_worker_template, key, value)

        return existing_worker_template

    async def delete(self, worker_template: WorkerTemplate) -> None:
        await self.session.delete(worker_template)

    async def refresh(self, worker_template: WorkerTemplate) -> None:
        await self.session.refresh(worker_template)

    async def commit(self) -> None:
        await self.session.commit()
