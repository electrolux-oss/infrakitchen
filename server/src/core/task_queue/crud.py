from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import delete, exists, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import aliased

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid
from core.users.model import User
from core.workers.model import Worker

from .enqueue import NOTIFY_STATEMENT
from .query_options import build_task_queue_query_options
from .model import FINISHED_STATUSES, TaskQueueItem, TaskQueueStatus


class TaskQueueCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, entity_id: str | UUID, fields: FieldSpec | None = None) -> TaskQueueItem | None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = select(TaskQueueItem).where(TaskQueueItem.id == entity_id)
        statement = statement.options(*build_task_queue_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[TaskQueueItem]:
        statement = select(TaskQueueItem)
        statement = evaluate_sqlalchemy_filters(TaskQueueItem, statement, filter)
        statement = evaluate_sqlalchemy_sorting(TaskQueueItem, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.options(*build_task_queue_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(TaskQueueItem)
        statement = evaluate_sqlalchemy_filters(TaskQueueItem, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def get_active_for_entities(self, entities: list[str], entity_ids: list[UUID]) -> list[Any]:
        """Queued and running tasks of the given entities, with worker host, creator and queue position.

        Returns rows of ``(TaskQueueItem, worker_host, creator_name, position)``, oldest first.
        """
        ranked = (
            select(
                TaskQueueItem.id.label("id"),
                func.row_number()
                .over(order_by=(TaskQueueItem.priority.desc(), TaskQueueItem.available_at, TaskQueueItem.seq))
                .label("position"),
            )
            .where(TaskQueueItem.status == TaskQueueStatus.QUEUED)
            .subquery()
        )
        statement = (
            select(TaskQueueItem, Worker.host, User.identifier, ranked.c.position)
            .outerjoin(ranked, ranked.c.id == TaskQueueItem.id)
            .outerjoin(Worker, Worker.id == TaskQueueItem.worker_id)
            .outerjoin(User, User.id == TaskQueueItem.created_by)
            .where(
                TaskQueueItem.entity.in_(entities),
                TaskQueueItem.entity_id.in_(entity_ids),
                TaskQueueItem.status.in_((TaskQueueStatus.QUEUED, TaskQueueStatus.RUNNING)),
            )
            .order_by(TaskQueueItem.seq)
        )
        return list((await self.session.execute(statement)).all())

    async def db_now(self) -> datetime:
        return (await self.session.execute(select(func.now()))).scalar_one()

    async def notify(self) -> None:
        """Wake up listening workers. Delivered by Postgres when the transaction commits."""
        _ = await self.session.execute(NOTIFY_STATEMENT)

    async def claim(self, worker_id: UUID, lease_seconds: int) -> TaskQueueItem | None:
        """Atomically take the next claimable task and lease it to ``worker_id``.

        Tasks whose entity already has a running task are skipped, so work on a
        single entity is serialized across all workers.
        """
        running = aliased(TaskQueueItem)
        entity_is_busy = exists().where(
            running.status == TaskQueueStatus.RUNNING,
            running.entity == TaskQueueItem.entity,
            running.entity_id == TaskQueueItem.entity_id,
        )
        next_id = (
            select(TaskQueueItem.id)
            .where(
                TaskQueueItem.status == TaskQueueStatus.QUEUED,
                TaskQueueItem.available_at <= func.now(),
                ~entity_is_busy,
            )
            .order_by(TaskQueueItem.priority.desc(), TaskQueueItem.available_at, TaskQueueItem.seq)
            .limit(1)
            .with_for_update(skip_locked=True, of=TaskQueueItem)
            .scalar_subquery()
        )
        statement = (
            update(TaskQueueItem)
            .where(TaskQueueItem.id == next_id)
            .values(
                status=TaskQueueStatus.RUNNING,
                worker_id=worker_id,
                locked_until=func.now() + timedelta(seconds=lease_seconds),
                attempts=TaskQueueItem.attempts + 1,
                started_at=func.now(),
                finished_at=None,
            )
            .returning(TaskQueueItem)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def claim_expired(self, worker_id: UUID, lease_seconds: int) -> TaskQueueItem | None:
        """Take over one running task whose lease expired (its worker is gone)."""
        expired_id = (
            select(TaskQueueItem.id)
            .where(TaskQueueItem.status == TaskQueueStatus.RUNNING, TaskQueueItem.locked_until < func.now())
            .order_by(TaskQueueItem.locked_until)
            .limit(1)
            .with_for_update(skip_locked=True)
            .scalar_subquery()
        )
        statement = (
            update(TaskQueueItem)
            .where(TaskQueueItem.id == expired_id)
            .values(worker_id=worker_id, locked_until=func.now() + timedelta(seconds=lease_seconds))
            .returning(TaskQueueItem)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def extend_lease(self, task_id: UUID, worker_id: UUID, lease_seconds: int) -> bool:
        """Extend the lease only while ``worker_id`` still owns the task."""
        statement = (
            update(TaskQueueItem)
            .where(*self._owned_by(task_id, worker_id))
            .values(locked_until=func.now() + timedelta(seconds=lease_seconds))
        )
        result = await self.session.execute(statement)
        return (getattr(result, "rowcount", 0) or 0) > 0

    @staticmethod
    def _owned_by(task_id: UUID, worker_id: UUID) -> tuple[Any, ...]:
        """Only the worker holding the lease may change a running task; a worker whose
        lease expired (and was reaped) must not overwrite what the new owner recorded."""
        return (
            TaskQueueItem.id == task_id,
            TaskQueueItem.worker_id == worker_id,
            TaskQueueItem.status == TaskQueueStatus.RUNNING,
        )

    async def finish(self, task_id: UUID, worker_id: UUID, status: TaskQueueStatus, error: str | None = None) -> bool:
        statement = (
            update(TaskQueueItem)
            .where(*self._owned_by(task_id, worker_id))
            .values(status=status, error=error, finished_at=func.now(), locked_until=None)
        )
        result = await self.session.execute(statement)
        return (getattr(result, "rowcount", 0) or 0) > 0

    async def requeue(self, task_id: UUID, worker_id: UUID, delay_seconds: float) -> bool:
        statement = (
            update(TaskQueueItem)
            .where(*self._owned_by(task_id, worker_id))
            .values(
                status=TaskQueueStatus.QUEUED,
                retries=TaskQueueItem.retries + 1,
                available_at=func.now() + timedelta(seconds=delay_seconds),
                worker_id=None,
                locked_until=None,
            )
        )
        result = await self.session.execute(statement)
        return (getattr(result, "rowcount", 0) or 0) > 0

    async def cancel_queued(self, task_id: UUID, reason: str) -> TaskQueueItem | None:
        """Cancel a task only while no worker has claimed it."""
        statement = (
            update(TaskQueueItem)
            .where(TaskQueueItem.id == task_id, TaskQueueItem.status == TaskQueueStatus.QUEUED)
            .values(status=TaskQueueStatus.CANCELLED, error=reason, finished_at=func.now())
            .returning(TaskQueueItem)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def delete_finished_before(self, before: datetime) -> int:
        statement = delete(TaskQueueItem).where(
            TaskQueueItem.status.in_(FINISHED_STATUSES), TaskQueueItem.finished_at < before
        )
        result = await self.session.execute(statement)
        return getattr(result, "rowcount", 0) or 0

    async def queue_counts(self) -> dict[str, Any]:
        now = func.now()
        is_queued = TaskQueueItem.status == TaskQueueStatus.QUEUED
        statement = select(
            func.count().filter(is_queued, TaskQueueItem.available_at <= now),
            func.count().filter(is_queued, TaskQueueItem.available_at > now),
            func.count().filter(TaskQueueItem.status == TaskQueueStatus.RUNNING),
            func.min(TaskQueueItem.available_at).filter(is_queued, TaskQueueItem.available_at <= now),
            now,
        )
        queued, delayed, running, oldest, db_now = (await self.session.execute(statement)).one()
        return {"queued": queued, "delayed": delayed, "running": running, "oldest": oldest, "now": db_now}

    async def worker_counts(self, alive_since: datetime) -> dict[str, int]:
        """Count workers by status; workers without a recent heartbeat count as offline."""
        statement = select(
            Worker.status,
            func.count().filter(Worker.updated_at >= alive_since),
            func.count().filter(Worker.updated_at < alive_since),
        ).group_by(Worker.status)
        counts = {"free": 0, "busy": 0, "offline": 0}
        for status, alive, stale in (await self.session.execute(statement)).all():
            if status in ("free", "busy"):
                counts[status] += alive
                counts["offline"] += stale
            else:
                counts["offline"] += alive + stale
        return counts

    async def commit(self) -> None:
        await self.session.commit()

    async def rollback(self) -> None:
        await self.session.rollback()
