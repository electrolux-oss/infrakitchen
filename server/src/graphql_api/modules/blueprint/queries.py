import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.blueprints.dependencies import get_blueprint_service
from application.blueprints.service import BlueprintService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.blueprint.types import BlueprintType


def _build_service(info: Info) -> BlueprintService:
    session = info.context["session"]
    return get_blueprint_service(session=session)


@strawberry.type
class BlueprintQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def blueprint(self, info: Info, id: uuid.UUID) -> BlueprintType | None:
        await check_api_permission(info, "blueprint", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "blueprint")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def blueprints(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[BlueprintType]:
        await check_api_permission(info, "blueprint", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "blueprints")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def blueprints_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "blueprint", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def blueprint_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "blueprint", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(blueprint_id=id, requester=requester)
