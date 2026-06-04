import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.service import AuthProviderService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.auth_provider.types import AuthProviderType


def _build_service(info: Info) -> AuthProviderService:
    session = info.context["session"]
    return get_auth_provider_service(session=session)


@strawberry.type
class AuthProviderQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def auth_provider(self, info: Info, id: uuid.UUID) -> AuthProviderType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "authProvider")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def auth_providers(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[AuthProviderType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "authProviders")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def auth_providers_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def auth_provider_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(auth_provider_id=id, requester=requester)
