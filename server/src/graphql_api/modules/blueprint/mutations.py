import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.blueprints.dependencies import get_blueprint_service
from application.blueprints.schema import BlueprintCreate, BlueprintUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.blueprint.types import BlueprintType


@strawberry_pydantic.input(model=BlueprintCreate, all_fields=False)
class BlueprintCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    template_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    external_template_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    wiring: JSON | None = None
    default_variables: JSON | None = None
    configuration: JSON | None = None
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=BlueprintUpdate, all_fields=False)
class BlueprintUpdateInput:
    name: str | None = None
    description: str | None = None
    labels: list[str] | None = None


@strawberry.input
class BlueprintActionInput:
    action: str


@strawberry.type
class BlueprintMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_blueprint(self, info: Info, input: BlueprintCreateInput) -> BlueprintType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_blueprint_service(session)
        return await service.create_blueprint(blueprint=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_blueprint(self, info: Info, id: uuid.UUID, input: BlueprintUpdateInput) -> BlueprintType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_blueprint_service(session)

        if ModelActions.EDIT not in await service.get_actions(blueprint_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_blueprint(blueprint_id=str(id), blueprint=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def blueprint_action(self, info: Info, id: uuid.UUID, input: BlueprintActionInput) -> BlueprintType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_blueprint_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(blueprint_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action(
            blueprint_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )
