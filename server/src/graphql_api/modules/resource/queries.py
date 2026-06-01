import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.resources.dependencies import get_resource_service
from application.resources.service import ResourceService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.resource.types import ResourceType


def _build_service(info: Info) -> ResourceService:
    session = info.context["session"]
    return get_resource_service(session=session)


@strawberry.type
class ResourceQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource(self, info: Info, id: uuid.UUID) -> ResourceType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "resource")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resources(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ResourceType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "resources")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resources_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(resource_id=id, requester=requester)
