import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.integrations.dependencies import get_integration_service
from application.integrations.schema import IntegrationCreate, IntegrationUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied, EntityNotFound
from core.users.functions import user_has_access_to_api, user_has_access_to_entity
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.integration.types import IntegrationType, IntegrationValidationType


@strawberry_pydantic.input(model=IntegrationCreate, all_fields=False)
class IntegrationCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    integration_type: str = strawberry.UNSET
    integration_provider: str = strawberry.UNSET
    labels: list[str] = strawberry.field(default_factory=list)
    configuration: JSON = strawberry.UNSET


@strawberry_pydantic.input(model=IntegrationUpdate, all_fields=False)
class IntegrationUpdateInput:
    name: str | None = None
    description: str | None = None
    labels: list[str] | None = None
    configuration: JSON | None = None


@strawberry.input
class IntegrationActionInput:
    action: str


@strawberry.type
class IntegrationMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_integration(self, info: Info, input: IntegrationCreateInput) -> IntegrationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_service(session)
        return await service.create_integration(integration=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_integration(self, info: Info, id: uuid.UUID, input: IntegrationUpdateInput) -> IntegrationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_service(session)

        if ModelActions.EDIT not in await service.get_actions(integration_id=str(id), requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_integration(
            integration_id=str(id), integration=input.to_pydantic(), requester=requester
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def integration_action(self, info: Info, id: uuid.UUID, input: IntegrationActionInput) -> IntegrationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(integration_id=str(id), requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action(
            integration_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_integration(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_service(session)

        if ModelActions.DELETE not in await service.get_actions(integration_id=str(id), requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(integration_id=str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def validate_integration(self, info: Info, id: uuid.UUID) -> IntegrationValidationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_service(session)

        if not await user_has_access_to_entity(requester, str(id), action="write", entity_name="integration"):
            raise AccessDenied("Access denied")

        integration = await service.get_by_id(integration_id=str(id))
        if not integration:
            raise EntityNotFound("Integration not found")

        result = await service.validate(
            integration_config=integration.configuration,
            integration_provider=integration.integration_provider,
        )
        return IntegrationValidationType(is_valid=result.is_valid, message=result.message)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def validate_integration_config(self, info: Info, input: IntegrationCreateInput) -> IntegrationValidationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_integration_service(session)

        if not await user_has_access_to_api(requester, "integration", action="write"):
            raise AccessDenied("Access denied")

        integration = input.to_pydantic()
        result = await service.validate(
            integration_config=integration.configuration,
            integration_provider=integration.integration_provider,
        )
        return IntegrationValidationType(is_valid=result.is_valid, message=result.message)
