import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.integrations.crud import IntegrationCRUD
from application.integrations.functions import get_integration_actions
from application.integrations.service import IntegrationService
from application.integrations.dependencies import get_integration_service
from core.errors import EntityNotFound
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.integration.types import IntegrationType


def _build_service(info: Info) -> IntegrationService:
    session = info.context["session"]
    return get_integration_service(session)


@strawberry.type
class IntegrationQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def integration(self, info: Info, id: uuid.UUID) -> IntegrationType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "integration")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def integrations(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[IntegrationType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "integrations")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def integrations_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def integration_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        session = info.context["session"]
        requester = info.context["request"].state.user
        crud = IntegrationCRUD(session=session)
        integration = await crud.get_by_id(id, fields={"status": None})
        if integration is None:
            raise EntityNotFound("Integration not found")
        return await get_integration_actions(requester, id, integration.status)
