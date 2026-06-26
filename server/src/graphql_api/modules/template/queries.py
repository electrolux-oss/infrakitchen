import uuid
from typing import Any, Literal, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.templates.service import TemplateService
from application.templates.dependencies import get_template_service
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.template.types import TemplateType


@strawberry.type
class TemplateTreeNodeType:
    id: uuid.UUID
    name: str
    status: str
    node_id: uuid.UUID
    children: list["TemplateTreeNodeType"]


def _build_service(info: Info) -> TemplateService:
    session = info.context["session"]
    return get_template_service(session)


@strawberry.type
class TemplateQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def template(self, info: Info, id: uuid.UUID) -> TemplateType | None:
        await check_api_permission(info, "template", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "template")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def templates(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[TemplateType]:
        await check_api_permission(info, "template", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "templates")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def templates_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "template", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def template_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "template", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(template_id=id, requester=requester)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def template_tree(
        self,
        info: Info,
        id: uuid.UUID,
        direction: str = "parents",
    ) -> TemplateTreeNodeType | None:
        await check_api_permission(info, "template", ["read"])
        service = _build_service(info)
        tree = await service.get_tree(
            template_id=str(id),
            direction=cast(Literal["parents", "children"], direction),
        )
        if tree is None:
            return None
        return _map_tree_node(tree)


def _map_tree_node(node: Any) -> TemplateTreeNodeType:
    return TemplateTreeNodeType(
        id=node.id,
        name=node.name,
        status=node.status,
        node_id=node.node_id,
        children=[_map_tree_node(child) for child in node.children],
    )
