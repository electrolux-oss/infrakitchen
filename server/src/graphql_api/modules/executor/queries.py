import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.executors.dependencies import get_executor_service
from application.executors.service import ExecutorService
from application.favorites.dependencies import get_favorite_service
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.executor.types import ExecutorType


def _build_service(info: Info) -> ExecutorService:
    session = info.context["session"]
    return get_executor_service(session=session, favorite_service=get_favorite_service(session=session))


@strawberry.type
class ExecutorQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def executor(self, info: Info, id: uuid.UUID) -> ExecutorType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "executor")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def executors(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ExecutorType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "executors")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def executors_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def executor_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(executor_id=id, requester=requester)
