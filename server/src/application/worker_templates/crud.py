from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.constants.model import ModelStatus
from core.database import (
    find_referencing_rows,
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.task_queue.enqueue import publish_tasks_changed
from core.task_queue.model import TaskQueueItem, TaskQueueStatus
from core.utils.model_tools import is_valid_uuid

from .functions import DEFAULT_LOCK_KEY
from .model import WorkerTemplate
from .query_options import build_worker_template_query_options
from .routing import correlated_target_sql


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

    async def get_status(self, worker_template_id: UUID) -> ModelStatus | None:
        statement = select(WorkerTemplate.status).where(WorkerTemplate.id == worker_template_id)
        return (await self.session.execute(statement)).scalar_one_or_none()

    async def set_last_error(self, worker_template_id: UUID, error: str | None) -> None:
        """Plain UPDATE: a template deleted meanwhile is simply skipped."""
        _ = await self.session.execute(
            update(WorkerTemplate).where(WorkerTemplate.id == worker_template_id).values(last_error=error)
        )

    async def set_backoff(
        self,
        worker_template_id: UUID,
        failures: int,
        blocked_until: datetime | None,
        failed_at: datetime | None,
    ) -> None:
        _ = await self.session.execute(
            update(WorkerTemplate)
            .where(WorkerTemplate.id == worker_template_id)
            .values(spawn_failures=failures, spawn_blocked_until=blocked_until, spawn_failed_at=failed_at)
        )

    async def get_default(self) -> WorkerTemplate | None:
        result = await self.session.execute(select(WorkerTemplate).where(WorkerTemplate.is_default.is_(True)))
        return result.scalars().first()

    async def lock_default(self) -> None:
        """Serialize default changes until commit, so concurrent ones never both set a default."""
        _ = await self.session.execute(select(func.pg_advisory_xact_lock(DEFAULT_LOCK_KEY)))

    async def set_default(self, worker_template: WorkerTemplate | None) -> None:
        """Make ``worker_template`` the only default one, None clears the default."""
        _ = await self.session.execute(
            update(WorkerTemplate).where(WorkerTemplate.is_default.is_(True)).values(is_default=False)
        )
        if worker_template is not None:
            worker_template.is_default = True
        await self.session.flush()
        if worker_template is not None:
            # server-side onupdate expires updated_at, reload it so it can be read outside the greenlet
            await self.session.refresh(worker_template)

    async def retarget_queued_tasks(self, entity: str | None = None, entity_id: UUID | str | None = None) -> int:
        """Route still-queued tasks again in the caller's transaction, after the default or a selection changed.

        Without ``entity`` every queued task is routed again. Returns how many tasks changed.
        """
        await self.session.flush()
        target = correlated_target_sql()
        conditions: list[ColumnElement[bool]] = [
            TaskQueueItem.status == TaskQueueStatus.QUEUED,
            TaskQueueItem.worker_template_id.is_distinct_from(target),
        ]
        if entity is not None:
            conditions.append(TaskQueueItem.entity == entity)
        if entity_id is not None:
            conditions.append(TaskQueueItem.entity_id == entity_id)
        statement = (
            update(TaskQueueItem)
            .where(*conditions)
            .values(worker_template_id=target)
            .returning(TaskQueueItem)
            .execution_options(synchronize_session=False)
        )
        changed = list((await self.session.execute(statement)).scalars().all())
        await publish_tasks_changed(self.session, changed)
        return len(changed)

    async def get_pool_infos(self, worker_template_ids: set[UUID]) -> list[Any]:
        """Name, status and last error of templates, to tell why their tasks wait."""
        if not worker_template_ids:
            return []
        statement = select(
            WorkerTemplate.id, WorkerTemplate.name, WorkerTemplate.status, WorkerTemplate.last_error
        ).where(WorkerTemplate.id.in_(worker_template_ids))
        return list((await self.session.execute(statement)).all())

    async def get_dependencies(self, worker_template: WorkerTemplate) -> list[Any]:
        """Entities that selected the worker template, including pending resource changes.
        The task queue only records routing, so it does not count."""
        return await find_referencing_rows(
            self.session,
            WorkerTemplate.__tablename__,
            worker_template.id,
            "worker_template_id",
            skip_tables=(TaskQueueItem.__tablename__,),
        )

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
