import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import aio_pika
import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.config import InfrakitchenConfig
from core.rabbitmq import RabbitMQConnection
from graphql_api.modules.log.subscriptions import _authenticate_subscription

logger = logging.getLogger(__name__)


@strawberry.type
class EventStreamMessage:
    event: str
    payload: JSON
    entity_id: str | None = None
    entity_name: str | None = None
    trace_id: str | None = None
    audit_log_id: str | None = None


@strawberry.type
class EventSubscription:
    @strawberry.subscription
    async def event_stream(self, info: Info) -> AsyncGenerator[EventStreamMessage, None]:
        if InfrakitchenConfig().websocket is False:
            raise PermissionError("WebSocket subscriptions are disabled")

        _authenticate_subscription(info)

        async with RabbitMQConnection() as connection:
            channel = await connection.get_channel()
            if channel is None:
                raise RuntimeError("Failed to create RabbitMQ channel")

            event_exchange = await channel.declare_exchange(
                "ik_event_messages",
                aio_pika.ExchangeType.FANOUT,
                auto_delete=False,
                durable=True,
            )

            queue = await channel.declare_queue(exclusive=True, auto_delete=True)
            await queue.bind(event_exchange)

            logger.info("GraphQL subscription: listening for event stream messages")

            async with queue.iterator(no_ack=True) as queue_iter:
                async for message in queue_iter:
                    msg: dict[str, Any] = json.loads(message.body.decode())
                    metadata = msg.pop("_metadata", {})

                    yield EventStreamMessage(
                        event=str(metadata.get("event", "")),
                        payload=JSON(msg),
                        entity_id=str(msg.get("id")) if msg.get("id") is not None else None,
                        entity_name=str(msg.get("_entity_name")) if msg.get("_entity_name") else None,
                        trace_id=str(metadata.get("trace_id")) if metadata.get("trace_id") else None,
                        audit_log_id=str(metadata.get("audit_log_id")) if metadata.get("audit_log_id") else None,
                    )
