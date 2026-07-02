import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.schema import AuthProviderCreate, AuthProviderUpdate
from core.auth_providers.service import AuthProviderService
from core.constants.model import ModelActions
from core.errors import AccessDenied
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.auth_provider.types import AuthProviderType


@strawberry_pydantic.input(model=AuthProviderCreate, all_fields=False)
class AuthProviderCreateInput:
    name: str = strawberry.UNSET
    description: str = ""
    enabled: bool = True
    auth_provider: str = strawberry.UNSET
    configuration: JSON = strawberry.UNSET
    filter_by_domain: list[str] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=AuthProviderUpdate, all_fields=False)
class AuthProviderUpdateInput:
    name: str | None = strawberry.UNSET
    description: str | None = strawberry.UNSET
    enabled: bool | None = strawberry.UNSET
    filter_by_domain: list[str] | None = strawberry.UNSET
    configuration: JSON | None = strawberry.UNSET


def _build_service(info: Info) -> AuthProviderService:
    session = info.context["session"]
    return get_auth_provider_service(session=session)


@strawberry.type
class AuthProviderMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_auth_provider(self, info: Info, input: AuthProviderCreateInput) -> AuthProviderType:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if not await user_is_super_admin(requester):
            raise AccessDenied("Access denied: super admin required")

        return await service.create_auth_provider(auth_provider=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_auth_provider(self, info: Info, id: uuid.UUID, input: AuthProviderUpdateInput) -> AuthProviderType:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if ModelActions.EDIT not in await service.get_actions(auth_provider_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT}")

        return await service.update_auth_provider(
            auth_provider_id=str(id), auth_provider=input.to_pydantic(), requester=requester
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_auth_provider(self, info: Info, id: uuid.UUID) -> bool:
        requester = info.context["request"].state.user
        service = _build_service(info)

        if ModelActions.DELETE not in await service.get_actions(auth_provider_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE}")

        await service.delete(auth_provider_id=str(id), requester=requester)
        return True
