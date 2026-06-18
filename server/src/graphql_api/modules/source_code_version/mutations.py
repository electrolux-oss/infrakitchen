import uuid
from typing import Any

import strawberry
from strawberry.scalars import JSON
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from application.source_code_versions.dependencies import get_source_code_version_service
from application.source_code_versions.schema import (
    SourceCodeVersionCreate,
    SourceCodeVersionUpdate,
    SourceConfigUpdateWithId,
)
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.source_code_version.types import SourceCodeVersionType, SourceConfigType


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


@strawberry.input
class SourceConfigUpdateItemInput:
    id: uuid.UUID
    required: bool = False
    default: JSON | None = strawberry.UNSET
    frozen: bool = False
    unique: bool = False
    restricted: bool = False
    options: list[str] = strawberry.field(default_factory=list)
    template_id: uuid.UUID = strawberry.UNSET
    reference_template_id: uuid.UUID | None = strawberry.UNSET
    output_config_name: str | None = strawberry.UNSET

    def to_pydantic(self) -> SourceConfigUpdateWithId:
        data: dict[str, Any] = {
            "id": self.id,
            "required": self.required,
            "frozen": self.frozen,
            "unique": self.unique,
            "restricted": self.restricted,
            "options": self.options,
            "template_id": self.template_id,
        }
        if self.default is not strawberry.UNSET:
            data["default"] = self.default
        if self.reference_template_id is not strawberry.UNSET:
            data["reference_template_id"] = self.reference_template_id
        if self.output_config_name is not strawberry.UNSET:
            data["output_config_name"] = self.output_config_name
        return SourceConfigUpdateWithId(**data)


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
    async def update_source_code_version_configs(
        self,
        info: Info,
        id: uuid.UUID,
        configs: list[SourceConfigUpdateItemInput],
    ) -> list[SourceConfigType]:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_source_code_version_service(session=session)

        if ModelActions.EDIT not in await service.get_actions(source_code_version_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        if not configs:
            return []

        return await service.update_configs_orm(
            source_code_version_id=str(id),
            configs=[config.to_pydantic() for config in configs],
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
