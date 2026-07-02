import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.tasks.dependencies import get_task_service
from core.tasks.service import TaskEntityService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.task.types import TaskType


def _build_service(info: Info) -> TaskEntityService:
    session = info.context["session"]
    return get_task_service(session=session)


@strawberry.type
class TaskQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def task(self, info: Info, id: uuid.UUID) -> TaskType | None:
        await check_api_permission(info, "task", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "task")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def tasks(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[TaskType]:
        await check_api_permission(info, "task", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "tasks")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def tasks_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "task", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )
