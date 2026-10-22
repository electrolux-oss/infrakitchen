import uuid
import logging
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.worker_templates.dependencies import get_worker_template_service
from core.workers.dependencies import get_worker_service
from core.workers.service import WorkerService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.worker.types import WorkerLogsType, WorkerType
from graphql_api.modules.worker_template.queries import MAX_LOG_LINES

logger = logging.getLogger(__name__)


def _build_service(info: Info) -> WorkerService:
    session = info.context["session"]
    return get_worker_service(session=session)


@strawberry.type
class WorkerQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker(self, info: Info, id: uuid.UUID) -> WorkerType | None:
        await check_api_permission(info, "worker", ["read"])
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
        await check_api_permission(info, "worker", ["read"])
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
        await check_api_permission(info, "worker", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def worker_logs(self, info: Info, id: uuid.UUID, tail: int = 500) -> WorkerLogsType:
        # Reading a worker's logs needs worker access only, not access to worker templates
        await check_api_permission(info, "worker", ["read"])
        worker = await _build_service(info).get_by_id(str(id))
        if worker is None:
            return WorkerLogsType(logs="", error="Worker not found")
        template_service = get_worker_template_service(session=info.context["session"])
        try:
            logs = await template_service.get_worker_logs(worker.name, worker.host, max(1, min(tail, MAX_LOG_LINES)))
        except Exception as e:
            logger.warning(f"Cannot read logs of worker {id}: {e}")
            return WorkerLogsType(logs="", error=str(e))
        return WorkerLogsType(logs=logs)
