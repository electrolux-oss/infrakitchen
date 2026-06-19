import uuid
from base64 import b64encode
from pathlib import Path
from typing import Any, Literal, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.resources.dependencies import get_resource_service
from application.resources.service import ResourceService
from application.workers.utils import get_resource_task
from core.constants.model import ModelActions
from core.errors import EntityNotFound
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.resource.types import (
    ResourceDownloadType,
    ResourceType,
    ResourceVariableSchemaType,
    ValidationRuleResponseType,
)


def _build_service(info: Info) -> ResourceService:
    session = info.context["session"]
    return get_resource_service(session=session)


@strawberry.type
class ResourceTreeNodeType:
    id: uuid.UUID
    name: str
    state: str
    status: str
    template_name: str
    node_id: uuid.UUID
    children: list["ResourceTreeNodeType"]


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

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_tree(
        self,
        info: Info,
        id: uuid.UUID,
        direction: str = "parents",
    ) -> ResourceTreeNodeType | None:
        service = _build_service(info)
        tree = await service.get_tree(
            resource_id=str(id),
            direction=cast(Literal["parents", "children"], direction),
        )
        if tree is None:
            return None
        return _map_tree_node(tree)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_metadata(self, info: Info, id: uuid.UUID) -> JSON:
        service = _build_service(info)
        metadata = await service.metadata(resource_id=str(id))
        return cast(JSON, cast(object, metadata))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_download(self, info: Info, id: uuid.UUID) -> ResourceDownloadType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        resource = await _build_service(info).query_by_id(id)
        if resource is None:
            raise EntityNotFound(f"Resource {id} not found")

        task_controller = await get_resource_task(
            session=session,
            obj_id=resource.id,
            user=requester,
            action=ModelActions.DOWNLOAD,
        )
        debug_package_path = Path(await task_controller.debug())

        return ResourceDownloadType(
            filename=debug_package_path.name,
            content_type="application/zip",
            content_base64=b64encode(debug_package_path.read_bytes()).decode("ascii"),
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_variable_schema(
        self,
        info: Info,
        source_code_version_id: uuid.UUID,
        parent_resource_ids: list[uuid.UUID] | None = None,
    ) -> list[ResourceVariableSchemaType]:
        service = _build_service(info)
        schema = await service.get_variable_schema(
            source_code_version_id=str(source_code_version_id),
            resource_ids=[str(resource_id) for resource_id in (parent_resource_ids or [])],
        )
        return [
            ResourceVariableSchemaType(
                name=item.name,
                type=item.type,
                description=item.description,
                options=item.options,
                required=item.required,
                frozen=item.frozen,
                unique=item.unique,
                sensitive=item.sensitive,
                restricted=item.restricted,
                value=item.value,
                index=item.index,
                validation_rules=[ValidationRuleResponseType.from_pydantic(rule) for rule in item.validation_rules],
            )
            for item in schema
        ]


def _map_tree_node(node: Any) -> ResourceTreeNodeType:
    return ResourceTreeNodeType(
        id=node.id,
        name=node.name,
        state=node.state,
        status=node.status,
        template_name=node.template_name,
        node_id=node.node_id,
        children=[_map_tree_node(child) for child in node.children],
    )
