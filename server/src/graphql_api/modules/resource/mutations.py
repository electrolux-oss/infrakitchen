import strawberry
from strawberry.types import Info

from application.resources.dependencies import get_resource_service
from core.errors import AccessDenied
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.notification.types import SubscriptionType


@strawberry.input
class ResourceSubscriptionCreateInput:
    resource_id: str
    inherit_children: bool = False
    user_id: str | None = None


@strawberry.input
class ResourceSubscriptionDeleteInput:
    resource_id: str
    inherit_children: bool = False
    user_id: str | None = None


@strawberry.type
class ResourceMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_resource_subscription(
        self,
        info: Info,
        input: ResourceSubscriptionCreateInput,
    ) -> list[SubscriptionType]:
        session = info.context["session"]
        requester = info.context["request"].state.user

        if input.user_id and str(input.user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can create subscriptions for other users")

        service = get_resource_service(session)

        subscriptions = await service.create_resource_subscription(
            resource_id=input.resource_id,
            requester=requester,
            inherit_children=input.inherit_children,
            user_id=input.user_id,
        )
        return subscriptions

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_resource_subscription(
        self,
        info: Info,
        input: ResourceSubscriptionDeleteInput,
    ) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user

        user_id = input.user_id

        if user_id and str(user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can delete subscriptions for other users")

        service = get_resource_service(session)

        return await service.delete_resource_subscription(
            resource_id=input.resource_id,
            requester=requester,
            inherit_children=input.inherit_children,
            user_id=user_id,
        )
