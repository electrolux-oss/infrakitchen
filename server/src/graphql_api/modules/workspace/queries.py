import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.workspaces.dependencies import get_workspace_service
from application.workspaces.service import WorkspaceService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.workspace.types import WorkspaceType


def _build_service(info: Info) -> WorkspaceService:
    session = info.context["session"]
    return get_workspace_service(session=session)


@strawberry.type
class WorkspaceQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workspace(self, info: Info, id: uuid.UUID) -> WorkspaceType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workspace")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workspaces(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[WorkspaceType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "workspaces")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workspaces_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def workspace_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(workspace_id=id, requester=requester)
