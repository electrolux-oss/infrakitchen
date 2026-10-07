import uuid
from typing import cast
from datetime import datetime

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from core.task_queue.model import TaskQueueItem
from graphql_api.dataloaders.entity_loaders import get_task_queue_status_loader, get_worker_host_loader

# Task entity -> the loader describing the entity its id points to
ENTITY_DATA_LOADER = {"workspace": "resource"}


task_queue_mapper = StrawberrySQLAlchemyMapper()


@task_queue_mapper.type(TaskQueueItem)
class TaskQueueItemType:
    # Internal ordering column; BigInteger has no GraphQL scalar mapping
    __exclude__ = ["seq"]

    entity: str = ""
    entity_id: uuid.UUID | None = None
    created_by: uuid.UUID | None = None
    worker_id: uuid.UUID | None = None

    @strawberry.field
    def entity_name(self) -> str:
        return "task_queue_item"

    @strawberry.field
    async def entity_data(self, info: Info) -> JSON | None:
        """Short info about the entity the task works on (workspace syncs are queued under the resource id)."""
        entity = self.entity
        entity_id = self.entity_id
        loader = info.context["loaders"].get(ENTITY_DATA_LOADER.get(entity, entity))
        if loader is None or entity_id is None:
            return None
        return await loader.load(str(entity_id))

    @strawberry.field
    async def creator(self, info: Info) -> JSON | None:
        created_by = self.created_by
        if created_by is None:
            return None
        user = await info.context["loaders"]["user"].load(str(created_by))
        if user is None:
            return None
        return cast(JSON, cast(object, {"id": user["id"], "identifier": user["name"], "entityName": "user"}))

    @strawberry.field
    async def worker_host(self, info: Info) -> str | None:
        worker_id = self.worker_id
        if worker_id is None:
            return None
        return await get_worker_host_loader(info).load(str(worker_id))


task_queue_mapper.finalize()


@strawberry.type
class TaskQueueStatsType:
    queued: int
    delayed: int
    running: int
    oldest_queued_seconds: float
    workers_free: int
    workers_busy: int
    workers_offline: int


@strawberry.type
class QueuedTaskType:
    id: uuid.UUID
    entity: str
    action: str | None
    status: str
    created_at: datetime
    available_at: datetime | None
    started_at: datetime | None
    retries: int
    max_retries: int
    position: int | None
    worker_host: str | None
    creator_id: uuid.UUID | None
    creator_name: str | None
    waiting_reason: str | None


@strawberry.type
class EntityQueueStatusType:
    tasks: list[QueuedTaskType]
    workers_free: int
    workers_online: int


async def resolve_task_queue_status(info: Info, entity_type: str, entity_id: object) -> EntityQueueStatusType | None:
    """Queued/running tasks for an entity page; batched per request through a DataLoader."""
    status = await get_task_queue_status_loader(info, entity_type).load(str(entity_id))
    if status is None:
        return None
    return EntityQueueStatusType(
        tasks=[QueuedTaskType(**task.model_dump()) for task in status.tasks],
        workers_free=status.workers_free,
        workers_online=status.workers_online,
    )
