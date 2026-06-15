import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from application.source_codes.dependencies import get_source_code_service
from application.source_codes.schema import SourceCodeCreate, SourceCodeUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.source_code.types import SourceCodeType


@strawberry_pydantic.input(model=SourceCodeCreate, all_fields=False)
class SourceCodeCreateInput:
    source_code_url: str = strawberry.UNSET
    source_code_provider: str = strawberry.UNSET
    source_code_language: str = strawberry.UNSET
    description: str = ""
    integration_id: uuid.UUID | None = None
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=SourceCodeUpdate, all_fields=False)
class SourceCodeUpdateInput:
    description: str | None = None
    integration_id: uuid.UUID | None = None
    labels: list[str] | None = None


@strawberry.input
class SourceCodeActionInput:
    action: str


@strawberry.type
class SourceCodeMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_source_code(self, info: Info, input: SourceCodeCreateInput) -> SourceCodeType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_service(session=session)
        return await service.create_source_code(source_code=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_source_code(self, info: Info, id: uuid.UUID, input: SourceCodeUpdateInput) -> SourceCodeType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_service(session=session)

        if ModelActions.EDIT not in await service.get_actions(source_code_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_source_code(
            source_code_id=str(id), source_code=input.to_pydantic(), requester=requester
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def source_code_action(self, info: Info, id: uuid.UUID, input: SourceCodeActionInput) -> SourceCodeType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_service(session=session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(source_code_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action(
            source_code_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_source_code(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_service(session=session)

        if ModelActions.DELETE not in await service.get_actions(source_code_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(source_code_id=str(id), requester=requester)
        return True
