import uuid

import strawberry
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.executors.dependencies import get_executor_service
from application.executors.schema import ExecutorCreate, ExecutorUpdate
from application.executors.service import ExecutorService
from application.favorites.dependencies import get_favorite_service
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.executor.types import ExecutorType


def _build_service(info: Info) -> ExecutorService:
    session = info.context["session"]
    return get_executor_service(session=session, favorite_service=get_favorite_service(session=session))


@strawberry_pydantic.input(model=ExecutorCreate, all_fields=True)
class ExecutorCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    runtime: str = "tofu"
    command_args: str = ""
    source_code_id: uuid.UUID = strawberry.UNSET
    source_code_version: str | None = None
    source_code_branch: str | None = None
    source_code_folder: str = ""
    integration_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    secret_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    storage_id: uuid.UUID | None = None
    storage_path: str | None = None
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=ExecutorUpdate, all_fields=False)
class ExecutorUpdateInput:
    description: str | None = None
    command_args: str | None = None
    source_code_id: uuid.UUID | None = None
    source_code_version: str | None = None
    source_code_branch: str | None = None
    source_code_folder: str | None = None
    integration_ids: list[uuid.UUID] | None = None
    secret_ids: list[uuid.UUID] | None = None
    storage_id: uuid.UUID | None = None
    storage_path: str | None = None
    labels: list[str] | None = None


@strawberry.input
class ExecutorActionInput:
    action: str


@strawberry.type
class ExecutorMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_executor(self, info: Info, input: ExecutorCreateInput) -> ExecutorType:
        requester = info.context["request"].state.user
        service = _build_service(info)
        return await service.create_executor(executor=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_executor(self, info: Info, id: uuid.UUID, input: ExecutorUpdateInput) -> ExecutorType:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if ModelActions.EDIT not in await service.get_actions(executor_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_executor(executor_id=str(id), executor=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def executor_action(self, info: Info, id: uuid.UUID, input: ExecutorActionInput) -> ExecutorType:
        requester = info.context["request"].state.user
        service = _build_service(info)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(executor_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action_executor(
            executor_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_executor(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if ModelActions.DELETE not in await service.get_actions(executor_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(executor_id=str(id), requester=requester)
        return True
