import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.tools.dependencies import get_tool_service
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.tool.types import ToolType


@strawberry.type
class ToolQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def tool(self, info: Info, id: uuid.UUID) -> ToolType | None:
        service = get_tool_service(session=info.context["session"])
        fields = build_field_spec(get_entity_selection(info.selected_fields, "tool"))
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def tool_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = get_tool_service(session=info.context["session"])
        requester = info.context["request"].state.user
        return await service.get_actions(tool_id=id, requester=requester)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def tools(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ToolType]:
        service = get_tool_service(session=info.context["session"])
        fields = build_field_spec(get_entity_selection(info.selected_fields, "tools"))
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def tools_count(self, info: Info, filter: JSON | None = None) -> int:
        service = get_tool_service(session=info.context["session"])
        return await service.count(filter=cast(dict[str, Any], cast(object, filter)) if filter else None)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def available_tool_versions(
        self,
        info: Info,
        name: str,
        include_prerelease: bool = False,
    ) -> list[str]:
        service = get_tool_service(session=info.context["session"])
        return await service.list_available_versions(name, include_prerelease=include_prerelease)
