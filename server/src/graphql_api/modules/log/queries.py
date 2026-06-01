import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.logs.dependencies import get_log_service
from core.logs.service import LogService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.log.types import LogType


def _build_service(info: Info) -> LogService:
    session = info.context["session"]
    return get_log_service(session=session)


@strawberry.type
class LogQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def log(self, info: Info, id: uuid.UUID) -> LogType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "log")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def logs(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[LogType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "logs")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def logs_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )
