import logging
from collections.abc import AsyncGenerator

import strawberry
from strawberry.types import Info

import core.pubsub as pubsub
from core.config import InfrakitchenConfig
from graphql_api.modules.log.subscriptions import _authenticate_subscription

logger = logging.getLogger(__name__)


@strawberry.type
class NotificationStreamMessage:
    """A single notification streamed to the user."""

    msg: str
    title: str | None = None
    status: str = "info"
    id: str | None = None
    event_type: str | None = None
    entity_type: str | None = None
    entity_id: str | None = None
    entity_name: str | None = None
    created_at: str | None = None


@strawberry.type
class NotificationSubscription:
    @strawberry.subscription
    async def notification_stream(
        self,
        info: Info,
    ) -> AsyncGenerator[NotificationStreamMessage, None]:
        """Subscribe to real-time notifications for the authenticated user.

        Listens on the user's ``notifications.in_app.<user_id>`` pubsub topic.
        """
        if InfrakitchenConfig().websocket is False:
            raise PermissionError("WebSocket subscriptions are disabled")

        user = await _authenticate_subscription(info)

        logger.info("GraphQL subscription: listening for notifications for user %s", user.id)
        try:
            async with pubsub.hub.subscribe(pubsub.in_app_notifications_topic(user.id)) as messages:
                async for msg in messages:
                    yield NotificationStreamMessage(
                        msg=msg.get("msg", ""),
                        title=msg.get("title"),
                        status=msg.get("status", "info"),
                        id=msg.get("id"),
                        event_type=msg.get("event_type"),
                        entity_type=msg.get("entity_type"),
                        entity_id=str(v) if (v := msg.get("entity_id")) else None,
                        entity_name=msg.get("entity_name"),
                        created_at=msg.get("created_at"),
                    )
        finally:
            logger.debug("GraphQL subscription: cleaned up notification stream for user %s", user.id)
