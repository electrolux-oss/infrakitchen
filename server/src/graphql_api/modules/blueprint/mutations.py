import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.blueprints.dependencies import get_blueprint_service
from application.blueprints.schema import BlueprintCreate, BlueprintUpdate
from application.workflows.schema import WorkflowRequest
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.blueprint.types import BlueprintType
from graphql_api.modules.workflow.types import WorkflowType


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
    template_ids: list[uuid.UUID] | None = None
    external_template_ids: list[uuid.UUID] | None = None
    wiring: JSON | None = None
    default_variables: JSON | None = None
    configuration: JSON | None = None


@strawberry.input
class BlueprintActionInput:
    action: str


@strawberry.input
class BlueprintWorkflowCreateInput:
    variable_overrides: JSON | None = strawberry.field(default_factory=dict)
    workspace_id: uuid.UUID | None = None
    integration_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    storage_id: uuid.UUID | None = None
    secret_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    source_code_version_overrides: JSON | None = strawberry.field(
        default_factory=dict,
    )
    parent_overrides: JSON | None = strawberry.field(default_factory=dict)

    def to_workflow_request(self) -> WorkflowRequest:
        variable_overrides = cast(dict[str, dict[str, Any]], self.variable_overrides or {})
        source_code_version_overrides = self.source_code_version_overrides or {}
        parent_overrides = self.parent_overrides or {}

        return WorkflowRequest(
            variable_overrides=variable_overrides,
            workspace_id=self.workspace_id,
            integration_ids=self.integration_ids,
            storage_id=self.storage_id,
            secret_ids=self.secret_ids,
            source_code_version_overrides={
                key: uuid.UUID(value) if isinstance(value, str) else value
                for key, value in cast(dict[str, Any], source_code_version_overrides).items()
            },
            parent_overrides={
                key: [uuid.UUID(resource_id) if isinstance(resource_id, str) else resource_id for resource_id in value]
                for key, value in cast(dict[str, list[Any]], parent_overrides).items()
            },
        )


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
    async def delete_blueprint(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_blueprint_service(session)

        if ModelActions.DELETE not in await service.get_actions(blueprint_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(blueprint_id=id, requester=requester)
        return True

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

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_blueprint_workflow(
        self,
        info: Info,
        id: uuid.UUID,
        input: BlueprintWorkflowCreateInput,
    ) -> WorkflowType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_blueprint_service(session)
        return await service.create_workflow(
            blueprint_id=id,
            request=input.to_workflow_request(),
            requester=requester,
        )
