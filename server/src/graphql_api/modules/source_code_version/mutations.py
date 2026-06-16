import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import SourceCodeVersionCreate, SourceCodeVersionUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.source_code_version.types import SourceCodeVersionType


@strawberry_pydantic.input(model=SourceCodeVersionCreate, all_fields=False)
class SourceCodeVersionCreateInput:
    template_id: uuid.UUID = strawberry.UNSET
    source_code_id: uuid.UUID = strawberry.UNSET
    source_code_version: str | None = None
    source_code_branch: str | None = None
    source_code_folder: str = ""
    description: str = ""
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=SourceCodeVersionUpdate, all_fields=False)
class SourceCodeVersionUpdateInput:
    description: str | None = None
    labels: list[str] | None = None


@strawberry.input
class SourceCodeVersionActionInput:
    action: str


@strawberry.type
class SourceCodeVersionMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_source_code_version(
        self, info: Info, input: SourceCodeVersionCreateInput
    ) -> SourceCodeVersionType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_version_service(session=session)
        return await service.create_source_code_version(source_code_version=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_source_code_version(
        self, info: Info, id: uuid.UUID, input: SourceCodeVersionUpdateInput
    ) -> SourceCodeVersionType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_version_service(session=session)

        if ModelActions.EDIT not in await service.get_actions(source_code_version_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_source_code_version(
            source_code_version_id=str(id),
            source_code_version=input.to_pydantic(),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def source_code_version_action(
        self, info: Info, id: uuid.UUID, input: SourceCodeVersionActionInput
    ) -> SourceCodeVersionType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_version_service(session=session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(source_code_version_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action(
            source_code_version_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_source_code_version(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_version_service(session=session)

        if ModelActions.DELETE not in await service.get_actions(source_code_version_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(source_code_version_id=str(id), requester=requester)
        return True
