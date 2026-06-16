import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.secrets.dependencies import get_secret_service
from application.secrets.schema import SecretCreate, SecretUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import AccessDenied, EntityNotFound
from core.users.functions import user_has_access_to_api
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.secret.types import SecretType, SecretValidationType


@strawberry_pydantic.input(model=SecretCreate, all_fields=False)
class SecretCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    secret_type: str = strawberry.UNSET
    secret_provider: str = strawberry.UNSET
    integration_id: uuid.UUID | None = None
    configuration: JSON = strawberry.UNSET
    labels: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=SecretUpdate, all_fields=False)
class SecretUpdateInput:
    description: str | None = strawberry.UNSET
    labels: list[str] | None = strawberry.UNSET
    secret_provider: str | None = strawberry.UNSET
    configuration: JSON | None = strawberry.UNSET


@strawberry.input
class SecretActionInput:
    action: str


@strawberry.type
class SecretMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_secret(self, info: Info, input: SecretCreateInput) -> SecretType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_secret_service(session)
        return await service.create_secret(secret=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_secret(self, info: Info, id: uuid.UUID, input: SecretUpdateInput) -> SecretType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_secret_service(session)

        if ModelActions.EDIT not in await service.get_actions(secret_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_secret(secret_id=str(id), secret=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def secret_action(self, info: Info, id: uuid.UUID, input: SecretActionInput) -> SecretType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_secret_service(session)

        actions_list = [action.value for action in ModelActions]
        if input.action not in actions_list:
            raise ValueError("Invalid action")

        if input.action not in await service.get_actions(secret_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {input.action}")

        return await service.patch_action_secret(
            secret_id=str(id),
            body=PatchBodyModel(action=input.action),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_secret(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_secret_service(session)

        if ModelActions.DELETE not in await service.get_actions(secret_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(secret_id=str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def validate_secret(self, info: Info, id: uuid.UUID) -> SecretValidationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_secret_service(session)

        if not await user_has_access_to_api(requester, "secret", action="write"):
            raise AccessDenied("Access denied")

        secret = await service.get_by_id(secret_id=str(id))
        if not secret:
            raise EntityNotFound("Secret not found")

        result = await service.validate(secret)
        return SecretValidationType(is_valid=result.is_valid, message=result.message)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def validate_secret_config(self, info: Info, input: SecretCreateInput) -> SecretValidationType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_secret_service(session)

        if not await user_has_access_to_api(requester, "secret", action="write"):
            raise AccessDenied("Access denied")

        result = await service.validate(input.to_pydantic())
        return SecretValidationType(is_valid=result.is_valid, message=result.message)
