import uuid
from enum import Enum

import strawberry
from strawberry.types import Info

from core.errors import AccessDenied, EntityNotFound
from core.notifications.dependencies import (
    get_subscription_service,
    get_notification_preference_service,
)
from core.notifications.model import NotificationChannel
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.notification.types import SubscriptionType, NotificationPreferenceType


@strawberry.enum
class NotificationChannelEnum(Enum):
    SLACK = "SLACK"
    IN_APP = "IN_APP"


@strawberry.input
class SubscriptionCreateInput:
    entity_type: str
    entity_id: str | None = None
    user_id: str | None = None


@strawberry.input
class NotificationPreferenceCreateInput:
    event_type: str
    channels: list[NotificationChannelEnum]
    user_id: str | None = None


@strawberry.type
class NotificationMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_subscription(self, info: Info, input: SubscriptionCreateInput) -> SubscriptionType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_subscription_service(session)
        user_id = input.user_id

        if user_id and user_id != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can create subscriptions for other users")

        return await service.create(
            requester=requester,
            entity_type=input.entity_type,
            entity_id=input.entity_id,
            user_id=user_id,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_subscription(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_subscription_service(session)

        subscription = await service.query_by_id(id)

        if not subscription:
            raise EntityNotFound("Subscription not found")

        if str(subscription.user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can delete subscriptions of other users")

        await service.delete(subscription_id=id)
        return True

    # Notification Preferences Mutations
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_notification_preference(
        self, info: Info, input: NotificationPreferenceCreateInput
    ) -> NotificationPreferenceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_notification_preference_service(session)

        return await service.create(
            requester=requester,
            event_type=input.event_type,
            channels=[NotificationChannel(c.value) for c in input.channels],
            user_id=input.user_id,
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_notification_preference(self, info: Info, id: uuid.UUID) -> bool:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_notification_preference_service(session)

        await service.delete(requester=requester, preference_id=id)
        return True
