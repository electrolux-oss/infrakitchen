import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.projects.service import ProjectService
from application.projects.dependencies import get_project_service
from graphql_api.helpers import (
    EntityAccess,
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
    resolve_access_restriction,
)
from graphql_api.modules.project.types import ProjectType


def _build_service(info: Info) -> ProjectService:
    session = info.context["session"]
    return get_project_service(session)


@strawberry.type
class ProjectQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def project(self, info: Info, id: uuid.UUID) -> ProjectType | None:
        await check_api_permission(info, "project", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "project")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def projects(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
        access: EntityAccess | None = None,
        include_ids: list[uuid.UUID] | None = None,
    ) -> list[ProjectType]:
        await check_api_permission(info, "project", ["read"])
        restrict_ids = await resolve_access_restriction(info, "project", access, include_ids)
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "projects")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
            restrict_ids=restrict_ids,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def projects_count(
        self,
        info: Info,
        filter: JSON | None = None,
        access: EntityAccess | None = None,
        include_ids: list[uuid.UUID] | None = None,
    ) -> int:
        await check_api_permission(info, "project", ["read"])
        restrict_ids = await resolve_access_restriction(info, "project", access, include_ids)
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            restrict_ids=restrict_ids,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def project_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "project", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(project_id=id, requester=requester)
