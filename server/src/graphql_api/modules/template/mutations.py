import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.templates.dependencies import get_template_service
from application.templates.schema import TemplateCreate, TemplateUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.template.types import TemplateType


@strawberry_pydantic.input(model=TemplateCreate, all_fields=True)
class TemplateCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    documentation: str = ""
    template: str = strawberry.UNSET
    parents: list[uuid.UUID] = strawberry.field(default_factory=list)
    children: list[uuid.UUID] = strawberry.field(default_factory=list)
    cloud_resource_types: list[str] = strawberry.field(default_factory=list)
    configuration: JSON | None = None
    labels: list[str] = strawberry.field(default_factory=list)
    abstract: bool = False


@strawberry_pydantic.input(model=TemplateUpdate, all_fields=False)
class TemplateUpdateInput:
    name: str | None = None
    description: str | None = ""
    documentation: str | None = ""
    parents: list[uuid.UUID] | None = None
    children: list[uuid.UUID] | None = None
    cloud_resource_types: list[str] | None = None
    configuration: JSON | None = None
    labels: list[str] | None = None


@strawberry.input
class TemplateActionInput:
    action: str


@strawberry.type
class TemplateMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_template(self, info: Info, input: TemplateCreateInput) -> TemplateType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_template_service(session)
        return await service.create_template(template=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_template(self, info: Info, id: uuid.UUID, input: TemplateUpdateInput) -> TemplateType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_template_service(session)

        if ModelActions.EDIT not in await service.get_actions(template_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_template(template_id=str(id), template=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def template_action(self, info: Info, id: uuid.UUID, input: TemplateActionInput) -> TemplateType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_template_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(template_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch(
            template_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_template(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_template_service(session)

        if ModelActions.DELETE not in await service.get_actions(template_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(template_id=str(id), requester=requester)
        return True
