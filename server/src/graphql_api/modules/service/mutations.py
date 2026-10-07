import uuid
from typing import cast

import strawberry
from strawberry.types import Info
from strawberry.experimental import pydantic as strawberry_pydantic

from application.services.dependencies import get_service_service
from application.services.schema import ServiceCreate, ServiceUpdate
from core.constants.model import ModelActions
from core.errors import AccessDenied
from core.users.functions import user_has_access_to_entity, user_is_super_admin
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.notification.types import SubscriptionType
from graphql_api.modules.permission.mutations import EntityPolicyCreateInput
from graphql_api.modules.permission.types import PermissionType
from graphql_api.modules.service.types import ServiceType


@strawberry_pydantic.input(model=ServiceCreate, all_fields=True)
class ServiceCreateInput:
    name: str = strawberry.UNSET
    display_name: str | None = None
    description: str = ""
    project_id: uuid.UUID = strawberry.UNSET
    repository_url: str | None = None
    labels: list[str] = strawberry.field(default_factory=list)
    owners: list[uuid.UUID] = strawberry.field(default_factory=list)


@strawberry_pydantic.input(model=ServiceUpdate, all_fields=False)
class ServiceUpdateInput:
    name: str | None = None
    display_name: str | None = None
    description: str | None = None
    project_id: uuid.UUID | None = None
    repository_url: str | None = None
    labels: list[str] | None = None
    owners: list[uuid.UUID] | None = None


@strawberry.input
class ServiceSubscriptionCreateInput:
    service_id: str
    user_id: str | None = None


@strawberry.input
class ServiceSubscriptionDeleteInput:
    service_id: str
    user_id: str | None = None


@strawberry.type
class ServiceMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_service(self, info: Info, input: ServiceCreateInput) -> ServiceType:
        await check_api_permission(info, "service", ["admin"])
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_service_service(session)
        return await service.create_service(service=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_service(self, info: Info, id: uuid.UUID, input: ServiceUpdateInput) -> ServiceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_service_service(session)

        if ModelActions.EDIT not in await service.get_actions(service_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.EDIT.value}")

        return await service.update_service(service_id=str(id), service=input.to_pydantic(), requester=requester)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_service(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_service_service(session)

        if ModelActions.DELETE not in await service.get_actions(service_id=id, requester=requester):
            raise AccessDenied(f"Access denied for action {ModelActions.DELETE.value}")

        await service.delete(service_id=str(id), requester=requester)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_service_policy(self, info: Info, input: EntityPolicyCreateInput) -> list[PermissionType]:
        session = info.context["session"]
        requester = info.context["request"].state.user

        if not await user_has_access_to_entity(requester, input.entity_id, "admin", "service"):  # pyright: ignore
            raise AccessDenied("Access denied: admin access to service required")

        service = get_service_service(session)
        return await service.create_service_policy(
            service_policy=input.to_pydantic(),
            requester=requester,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_service_subscription(
        self,
        info: Info,
        input: ServiceSubscriptionCreateInput,
    ) -> list[SubscriptionType]:
        session = info.context["session"]
        requester = info.context["request"].state.user

        if input.user_id and str(input.user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can create subscriptions for other users")

        service = get_service_service(session)
        subscriptions = await service.create_service_subscription(
            service_id=input.service_id,
            requester=requester,
            user_id=input.user_id,
        )
        return cast(list[SubscriptionType], subscriptions)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_service_subscription(
        self,
        info: Info,
        input: ServiceSubscriptionDeleteInput,
    ) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user

        user_id = input.user_id
        if user_id and str(user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can delete subscriptions for other users")

        service = get_service_service(session)
        return await service.delete_service_subscription(
            service_id=input.service_id,
            requester=requester,
            user_id=user_id,
        )
