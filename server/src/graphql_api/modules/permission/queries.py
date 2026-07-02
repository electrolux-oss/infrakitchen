import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.permissions.service import PermissionService
from core.permissions.dependencies import get_permission_service
from core.users.functions import user_apis_permissions
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.permission.types import PermissionType, RoleType


def _build_service(info: Info) -> PermissionService:
    session = info.context["session"]
    return get_permission_service(session)


@strawberry.type
class PermissionQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def permission(self, info: Info, id: uuid.UUID) -> PermissionType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "permission")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def permissions(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[PermissionType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "permissions")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def permissions_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def roles(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[RoleType]:
        service = _build_service(info)

        base_filter: dict[str, Any] = {"ptype": "g"}
        if filter:
            base_filter.update(cast(dict[str, Any], cast(object, filter)))

        result = await service.query_all_roles(
            filter=base_filter,
            sort=parse_sort(sort),
            range=parse_range(range),
        )
        return [
            RoleType(
                id=row.id,
                v1=row.v1,
            )
            for row in result
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def roles_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)

        base_filter: dict[str, Any] = {"ptype": "g"}
        if filter:
            base_filter.update(cast(dict[str, Any], cast(object, filter)))

        return await service.count_roles(filter=base_filter)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def user_api_policies(self, info: Info) -> JSON:
        requester = info.context["request"].state.user
        if not requester:
            return JSON({})
        policies = await user_apis_permissions(requester)
        return JSON({k: v for k, v in policies.items() if k.startswith("api:") or k == "*"})

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def permission_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        requester = info.context["request"].state.user
        service = _build_service(info)
        return await service.get_actions(permission_id=id, requester=requester)
