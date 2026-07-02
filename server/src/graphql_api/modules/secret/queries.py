import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.secrets.dependencies import get_secret_service
from application.secrets.service import SecretService
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    check_api_permission,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.secret.types import SecretType


def _build_service(info: Info) -> SecretService:
    session = info.context["session"]
    return get_secret_service(session=session)


@strawberry.type
class SecretQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def secret(self, info: Info, id: uuid.UUID) -> SecretType | None:
        await check_api_permission(info, "secret", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "secret")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def secrets(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SecretType]:
        await check_api_permission(info, "secret", ["read"])
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "secrets")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def secrets_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        await check_api_permission(info, "secret", ["read"])
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def secret_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        await check_api_permission(info, "secret", ["read"])
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(secret_id=id, requester=requester)
