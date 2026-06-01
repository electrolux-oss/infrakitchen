import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from application.batch_operations.dependencies import get_batch_operation_service
from application.batch_operations.service import BatchOperationService
from graphql_api.helpers import IsAuthenticated, build_field_spec, get_entity_selection, parse_range, parse_sort
from graphql_api.modules.batch_operation.types import BatchOperationType


def _build_service(info: Info) -> BatchOperationService:
    session = info.context["session"]
    return get_batch_operation_service(session=session)


@strawberry.type
class BatchOperationQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def batch_operation(
        self,
        info: Info,
        id: uuid.UUID,
    ) -> BatchOperationType | None:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "batchOperation")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def batch_operations(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[BatchOperationType]:
        service = _build_service(info)
        entity_fields = get_entity_selection(info.selected_fields, "batchOperations")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def batch_operations_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        service = _build_service(info)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def batch_operation_actions(self, info: Info, id: uuid.UUID) -> list[str]:
        service = _build_service(info)
        requester = info.context["request"].state.user
        return await service.get_actions(batch_operation_id=id, requester=requester)
