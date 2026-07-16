import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import aio_pika
import strawberry
from strawberry.types import Info

from core.config import InfrakitchenConfig
from core.rabbitmq import RabbitMQConnection
from graphql_api.modules.log.subscriptions import _authenticate_subscription

logger = logging.getLogger(__name__)


@strawberry.type
class NotificationStreamMessage:
    """A single notification streamed to the user."""

    msg: str
    title: str | None = None
    status: str = "info"
    entity_id: str | None = None
    entity_name: str | None = None


@strawberry.type
class NotificationSubscription:
    @strawberry.subscription
    async def notification_stream(
        self,
        info: Info,
    ) -> AsyncGenerator[NotificationStreamMessage, None]:
        """Subscribe to real-time notifications for the authenticated user.

        Binds an exclusive RabbitMQ queue to the ``ik_notification_messages``
        exchange with routing key ``notifications`` so the user receives all
        broadcast notifications.
        """
        if InfrakitchenConfig().websocket is False:
            raise PermissionError("WebSocket subscriptions are disabled")

        user = await _authenticate_subscription(info)

        async with RabbitMQConnection() as connection:
            channel = await connection.get_channel()
            if channel is None:
                raise RuntimeError("Failed to create RabbitMQ channel")

            try:
                notification_exchange = await channel.declare_exchange(
                    "ik_notification_messages",
                    aio_pika.ExchangeType.TOPIC,
                    auto_delete=False,
                    durable=True,
                )

                queue = await channel.declare_queue(exclusive=True, auto_delete=True)
                await queue.bind(notification_exchange, routing_key=f"notifications.in_app.{user.id}")

                logger.info("GraphQL subscription: listening for notifications for user %s", user.id)

                async with queue.iterator(no_ack=True) as queue_iter:
                    async for message in queue_iter:
                        msg: dict[str, Any] = json.loads(message.body.decode())
                        msg.pop("_metadata", None)

                        yield NotificationStreamMessage(
                            msg=msg.get("msg", ""),
                            title=msg.get("title"),
                            status=msg.get("status", "info"),
                            entity_id=str(v) if (v := msg.get("entity_id")) else None,
                            entity_name=msg.get("entity_name"),
                        )
            finally:
                logger.debug("GraphQL subscription: cleaned up notification stream for user %s", user.id)
