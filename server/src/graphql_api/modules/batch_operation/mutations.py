import uuid
from typing import Literal, cast

import strawberry
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.batch_operations.dependencies import get_batch_operation_service
from application.batch_operations.schema import (
    BatchOperationCreate,
    BatchOperationEntityIdsPatch,
)
from application.batch_operations.service import BatchOperationService
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.batch_operation.types import BatchOperationType


@strawberry_pydantic.input(model=BatchOperationCreate, all_fields=True)
class BatchOperationCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    entity_type: str = "resource"
    entity_ids: list[uuid.UUID] = strawberry.UNSET


@strawberry.input
class BatchOperationEntityIdsInput:
    action: str
    entity_ids: list[uuid.UUID]


def _build_service(info: Info) -> BatchOperationService:
    session = info.context["session"]
    return get_batch_operation_service(session=session)


@strawberry.type
class BatchOperationMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_batch_operation(self, info: Info, input: BatchOperationCreateInput) -> BatchOperationType:
        requester = info.context["request"].state.user
        service = _build_service(info)
        return await service.create_batch_operation(batch_operation=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def batch_operation_entity_ids(
        self,
        info: Info,
        id: uuid.UUID,
        input: BatchOperationEntityIdsInput,
    ) -> BatchOperationType:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if input.action not in ("add", "remove"):
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(batch_operation_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        body = BatchOperationEntityIdsPatch(
            action=cast(Literal["add", "remove"], input.action),
            entity_ids=input.entity_ids,
        )
        return await service.patch_entity_ids_orm(batch_operation_id=id, body=body, requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_batch_operation(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if "delete" not in await service.get_actions(batch_operation_id=id, requester=requester):
            raise AccessDenied("Access denied for action delete")

        await service.delete(batch_operation_id=id, requester=requester)
        return True
