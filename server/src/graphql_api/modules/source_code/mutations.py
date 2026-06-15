import uuid
from typing import Any, cast

import strawberry
from strawberry.types import Info

from application.source_codes.dependencies import get_source_code_service
from application.source_codes.schema import SourceCodeCreate, SourceCodeUpdate
from application.types import CodeLanguageType, GitProviderType
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied, EntityNotFound
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.source_code.types import SourceCodeType


@strawberry.input
class SourceCodeCreateInput:
    source_code_url: str
    source_code_provider: str
    source_code_language: str
    description: str = ""
    integration_id: uuid.UUID | None = None
    labels: list[str] = strawberry.field(default_factory=list)

    def to_pydantic(self) -> SourceCodeCreate:
        return SourceCodeCreate(
            source_code_url=self.source_code_url,
            source_code_provider=cast(GitProviderType, self.source_code_provider),
            source_code_language=cast(CodeLanguageType, self.source_code_language),
            description=self.description,
            integration_id=self.integration_id,
            labels=self.labels,
        )


@strawberry.input
class SourceCodeUpdateInput:
    description: str | None = strawberry.UNSET
    integration_id: uuid.UUID | None = strawberry.UNSET
    labels: list[str] | None = strawberry.UNSET

    def to_pydantic(self) -> SourceCodeUpdate:
        data: dict[str, Any] = {}
        if self.description is not strawberry.UNSET:
            data["description"] = self.description
        if self.integration_id is not strawberry.UNSET:
            data["integration_id"] = self.integration_id
        # Forward `labels` whenever the client provided it (including `[]` to clear or an
        # explicit `null`). `labels` is non-nullable on SourceCodeUpdate, so passing `None`
        # lets Pydantic reject it, matching REST validation semantics. Omission stays unset.
        if self.labels is not strawberry.UNSET:
            data["labels"] = self.labels
        return SourceCodeUpdate(**data)


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

        await service.patch(
            source_code_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

        source_code = await service.query_by_id(id)
        if source_code is None:
            raise EntityNotFound("SourceCode not found")
        return source_code

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_source_code(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_service(session=session)

        if ModelActions.DELETE not in await service.get_actions(source_code_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(source_code_id=str(id), requester=requester)
        return True
