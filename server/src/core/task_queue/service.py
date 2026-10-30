import logging
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy.exc import IntegrityError

from core.config import Settings
from core.database import FieldSpec

from .crud import TaskQueueCRUD
from .model import (
    EntityQueueStatus,
    QueuedTaskInfo,
    TaskQueueItem,
    TaskQueueItemDTO,
    TaskQueueStats,
    TaskQueueStatus,
    WaitingReason,
)

logger = logging.getLogger(__name__)


def worker_alive_seconds() -> int:
    """A worker that missed three heartbeats is considered offline."""
    return Settings().WORKER_HEARTBEAT_SECONDS * 3


class TaskQueueService:
    def __init__(self, crud: TaskQueueCRUD):
        self.crud: TaskQueueCRUD = crud

    async def query_by_id(self, entity_id: str | UUID, fields: FieldSpec | None = None) -> TaskQueueItem | None:
        return await self.crud.get_by_id(entity_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[TaskQueueItem]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def claim(
        self, worker_id: UUID, lease_seconds: int, worker_template_id: UUID | None = None
    ) -> TaskQueueItemDTO | None:
        # Two workers can race for different queued tasks of the same entity; the unique
        # "one running task per entity" index rejects the loser, which then simply retries.
        for _ in range(2):
            try:
                item = await self.crud.claim(worker_id, lease_seconds, worker_template_id)
                if item:
                    await self.crud.notify_changed(item)
                await self.crud.commit()
            except IntegrityError:
                await self.crud.rollback()
                continue
            return TaskQueueItemDTO.model_validate(item) if item else None
        return None

    async def claim_expired(
        self, worker_id: UUID, lease_seconds: int, worker_template_id: UUID | None = None
    ) -> TaskQueueItemDTO | None:
        item = await self.crud.claim_expired(worker_id, lease_seconds, worker_template_id)
        if item:
            await self.crud.notify_changed(item)
        await self.crud.commit()
        return TaskQueueItemDTO.model_validate(item) if item else None

    async def heartbeat(self, task_id: UUID, worker_id: UUID, lease_seconds: int) -> bool:
        extended = await self.crud.extend_lease(task_id, worker_id, lease_seconds)
        await self.crud.commit()
        if not extended:
            logger.warning(f"Worker {worker_id} lost the lease on task {task_id}")
        return extended

    async def complete(self, task_id: UUID, worker_id: UUID) -> bool:
        return await self._finish(task_id, worker_id, TaskQueueStatus.DONE)

    async def fail(self, task_id: UUID, worker_id: UUID, error: str) -> bool:
        return await self._finish(task_id, worker_id, TaskQueueStatus.FAILED, error=error)

    async def _finish(self, task_id: UUID, worker_id: UUID, status: TaskQueueStatus, error: str | None = None) -> bool:
        item = await self.crud.finish(task_id, worker_id, status, error=error)
        if item:
            await self.crud.notify_changed(item)
        await self.crud.commit()
        if not item:
            logger.warning(f"Worker {worker_id} no longer owns task {task_id}; not marking it {status}")
        return item is not None

    async def requeue(self, task_id: UUID, worker_id: UUID, delay_seconds: float) -> bool:
        item = await self.crud.requeue(task_id, worker_id, delay_seconds)
        if item:
            await self.crud.notify()
            await self.crud.notify_changed(item)
        await self.crud.commit()
        if not item:
            logger.warning(f"Worker {worker_id} no longer owns task {task_id}; not re-queueing it")
        return item is not None

    async def cancel_queued(self, task_id: UUID, reason: str) -> TaskQueueItemDTO | None:
        """Cancel a task that is still waiting for a worker.

        Returns None when the task is no longer queued (a worker already claimed it,
        or it finished or was cancelled meanwhile). The caller commits.
        """
        item = await self.crud.cancel_queued(task_id, reason)
        if item:
            await self.crud.notify_changed(item)
        return TaskQueueItemDTO.model_validate(item) if item else None

    async def purge_finished(self, older_than_days: int) -> int:
        deleted = await self.crud.delete_finished_before(datetime.now(UTC) - timedelta(days=older_than_days))
        await self.crud.commit()
        return deleted

    async def get_entity_queue_status(
        self, entities: list[str], entity_ids: list[UUID], worker_alive_seconds: int
    ) -> dict[UUID, EntityQueueStatus]:
        """Active (queued or running) tasks per entity id, with why each queued task is still waiting.

        Entities without active tasks are left out of the result.
        """
        rows = await self.crud.get_active_for_entities(entities, entity_ids)
        if not rows:
            return {}

        now = await self.crud.db_now()
        alive_since = datetime.now(UTC) - timedelta(seconds=worker_alive_seconds)
        pools = await self.crud.worker_counts_by_template(alive_since)
        # The UI falls back to these for tasks of static workers when a live update has no pool reason
        static = pools.get(None, {"free": 0, "busy": 0})

        statuses: dict[UUID, EntityQueueStatus] = {}
        for item, worker_host, creator_name, position in rows:
            status = statuses.setdefault(
                item.entity_id,
                EntityQueueStatus(workers_free=static["free"], workers_online=static["free"] + static["busy"]),
            )
            status.tasks.append(
                QueuedTaskInfo(
                    id=item.id,
                    entity=item.entity,
                    action=item.action,
                    status=TaskQueueStatus(item.status),
                    created_at=item.created_at,
                    available_at=item.available_at,
                    started_at=item.started_at,
                    retries=item.retries,
                    max_retries=item.max_retries,
                    position=position,
                    worker_host=worker_host,
                    worker_template_id=item.worker_template_id,
                    creator_id=item.created_by,
                    creator_name=creator_name,
                )
            )

        for status in statuses.values():
            running_entities = {t.entity for t in status.tasks if t.status == TaskQueueStatus.RUNNING}
            for task in status.tasks:
                if task.status == TaskQueueStatus.QUEUED:
                    task.pool_reason = self._pool_reason(task, pools.get(task.worker_template_id))
                    task.waiting_reason = self._waiting_reason(task, running_entities, now) or task.pool_reason
        return statuses

    @staticmethod
    def _waiting_reason(task: QueuedTaskInfo, running_entities: set[str], now: datetime) -> WaitingReason | None:
        """Why the task waits whatever its workers do; None when only its workers can tell."""
        delayed = task.available_at is not None and task.available_at > now
        if delayed and task.retries == 0:
            return WaitingReason.CANCEL_WINDOW
        if task.entity in running_entities:
            return WaitingReason.ENTITY_BUSY
        if delayed:
            return WaitingReason.RETRY_DELAY
        return None

    @staticmethod
    def _pool_reason(task: QueuedTaskInfo, workers: dict[str, int] | None) -> WaitingReason:
        """Why the workers of the task's pool don't take it right now."""
        free = (workers or {}).get("free", 0)
        online = free + (workers or {}).get("busy", 0)
        if online == 0:
            # A pool of a worker template gets its workers spawned on demand
            return WaitingReason.SPAWNING if task.worker_template_id else WaitingReason.NO_WORKERS
        if free == 0:
            return WaitingReason.WORKERS_BUSY
        return WaitingReason.PENDING_PICKUP

    async def count_claimable_by_template(self) -> dict[UUID | None, int]:
        return await self.crud.count_claimable_by_template()

    async def worker_counts_by_template(self, worker_alive_seconds: int) -> dict[UUID | None, dict[str, int]]:
        """Free, busy and offline workers per worker pool (None: static workers)."""
        return await self.crud.worker_counts_by_template(datetime.now(UTC) - timedelta(seconds=worker_alive_seconds))

    async def count_claimable(self, worker_template_id: UUID | None) -> int:
        """Tasks workers of ``worker_template_id`` could take; None is the pool of static workers."""
        return await self.crud.count_claimable(worker_template_id)

    async def stats(self, worker_alive_seconds: int) -> TaskQueueStats:
        counts = await self.crud.queue_counts()
        oldest: datetime | None = counts["oldest"]
        oldest_seconds = (counts["now"] - oldest).total_seconds() if oldest else 0.0
        pools = await self.crud.worker_counts_by_template(datetime.now(UTC) - timedelta(seconds=worker_alive_seconds))
        workers = {status: sum(pool[status] for pool in pools.values()) for status in ("free", "busy", "offline")}
        return TaskQueueStats(
            queued=counts["queued"],
            delayed=counts["delayed"],
            running=counts["running"],
            oldest_queued_seconds=max(oldest_seconds, 0.0),
            workers_free=workers["free"],
            workers_busy=workers["busy"],
            workers_offline=workers["offline"],
        )
