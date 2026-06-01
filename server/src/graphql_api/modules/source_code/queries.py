import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.source_codes.dependencies import get_source_code_service
from application.source_codes.service import SourceCodeService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.source_code.types import SourceCodeType


def _build_service(info: Info) -> SourceCodeService:
    session = info.context["session"]
    return get_source_code_service(session=session)


@strawberry.type
class SourceCodeQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code(self, info: Info, id: uuid.UUID) -> SourceCodeType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "sourceCode")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_codes(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SourceCodeType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "sourceCodes")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_codes_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def source_code_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(source_code_id=id, requester=requester)
