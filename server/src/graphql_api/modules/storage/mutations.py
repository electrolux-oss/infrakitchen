import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.storages.dependencies import get_storage_service
from application.storages.schema import StorageCreate, StorageUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.storage.types import StorageType


@strawberry_pydantic.input(model=StorageCreate, all_fields=False)
class StorageCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    storage_type: str = strawberry.UNSET
    storage_provider: str = strawberry.UNSET
    integration_id: uuid.UUID = strawberry.UNSET
    configuration: JSON = strawberry.UNSET
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=StorageUpdate, all_fields=False)
class StorageUpdateInput:
    description: str | None = strawberry.UNSET
    labels: list[str] | None = strawberry.UNSET


@strawberry.input
class StorageActionInput:
    action: str


@strawberry.type
class StorageMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_storage(self, info: Info, input: StorageCreateInput) -> StorageType:
        await check_api_permission(info, "storage", ["admin"])
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_storage_service(session)
        return await service.create_storage(storage=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_storage(self, info: Info, id: uuid.UUID, input: StorageUpdateInput) -> StorageType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_storage_service(session)

        if ModelActions.EDIT not in await service.get_actions(storage_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_storage(storage_id=str(id), storage=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def storage_action(self, info: Info, id: uuid.UUID, input: StorageActionInput) -> StorageType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_storage_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(storage_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action(
            storage_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_storage(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_storage_service(session)

        if ModelActions.DELETE not in await service.get_actions(storage_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(storage_id=str(id), requester=requester)
        return True
