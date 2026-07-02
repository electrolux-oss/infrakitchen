import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.users.dependencies import get_user_service
from core.users.service import UserService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.user.types import UserType


def _build_service(info: Info) -> UserService:
    session = info.context["session"]
    return get_user_service(session=session)


@strawberry.type
class UserQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def current_user(self, info: Info) -> UserType | None:
        await check_api_permission(info, "user", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        entity_fields = get_entity_selection(info.selected_fields, "currentUser")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(requester.id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def user(self, info: Info, id: uuid.UUID) -> UserType | None:
        await check_api_permission(info, "user", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "user")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def users(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[UserType]:
        await check_api_permission(info, "user", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "users")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def users_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "user", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def user_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "user", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(user_id=id, requester=requester)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def user_entity_permissions(self, info: Info, entity_id: uuid.UUID, entity_name: str) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_user_entity_permissions(requester, entity_id, entity_name)
