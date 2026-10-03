import logging
from collections.abc import AsyncGenerator
from typing import Any

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

import core.pubsub as pubsub
from core.config import InfrakitchenConfig
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

        await _authenticate_subscription(info)

        logger.info("GraphQL subscription: listening for event stream messages")
        async with pubsub.hub.subscribe(pubsub.EVENTS_TOPIC) as messages:
            async for message in messages:
                msg: dict[str, Any] = dict(message)
                metadata = msg.pop("_metadata", {})

                yield EventStreamMessage(
                    event=str(metadata.get("event", "")),
                    payload=JSON(msg),
                    entity_id=str(msg.get("id")) if msg.get("id") is not None else None,
                    entity_name=str(msg.get("_entity_name")) if msg.get("_entity_name") else None,
                    trace_id=str(metadata.get("trace_id")) if metadata.get("trace_id") else None,
                    audit_log_id=str(metadata.get("audit_log_id")) if metadata.get("audit_log_id") else None,
                )
