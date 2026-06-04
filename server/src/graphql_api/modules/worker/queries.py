import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.workers.dependencies import get_worker_service
from core.workers.service import WorkerService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.worker.types import WorkerType


def _build_service(info: Info) -> WorkerService:
    session = info.context["session"]
    return get_worker_service(session=session)


@strawberry.type
class WorkerQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker(self, info: Info, id: uuid.UUID) -> WorkerType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "worker")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workers(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[WorkerType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workers")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workers_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )
