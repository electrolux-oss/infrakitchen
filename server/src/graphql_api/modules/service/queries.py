import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.services.service import ServiceService
from application.services.dependencies import get_service_service
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.service.types import ServiceType


def _build_service(info: Info) -> ServiceService:
    session = info.context["session"]
    return get_service_service(session)


@strawberry.type
class ServiceQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def service(self, info: Info, id: uuid.UUID) -> ServiceType | None:
        await check_api_permission(info, "service", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "service")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def services(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ServiceType]:
        await check_api_permission(info, "service", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "services")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def services_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "service", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def service_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "service", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(service_id=id, requester=requester)
