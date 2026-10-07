from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.task_queue.dependencies import get_task_queue_service
from core.task_queue.service import TaskQueueService, worker_alive_seconds
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.task_queue.types import TaskQueueItemType, TaskQueueStatsType


def _build_service(info: Info) -> TaskQueueService:
    session = info.context["session"]
    return get_task_queue_service(session=session)


@strawberry.type
class TaskQueueQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def task_queue_stats(self, info: Info) -> TaskQueueStatsType:
        """Queue backlog and worker availability; the input for worker autoscaling."""
        await check_api_permission(info, "worker", ["read"])
        service = _build_service(info)
        stats = await service.stats(worker_alive_seconds=worker_alive_seconds())
        return TaskQueueStatsType(**stats.model_dump())

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def task_queue_items(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[TaskQueueItemType]:
        await check_api_permission(info, "task", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "taskQueueItems")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def task_queue_items_count(self, info: Info, filter: JSON | None = None) -> int:
        await check_api_permission(info, "task", ["read"])
        service = _build_service(info)
        return await service.count(filter=cast(dict[str, Any], cast(object, filter)) if filter else None)
