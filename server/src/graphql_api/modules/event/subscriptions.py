import logging
from collections.abc import AsyncGenerator
from typing import Any

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

import core.pubsub as pubsub
from core.config import InfrakitchenConfig
from core.personal_access_tokens.scopes import get_current_token_scopes, scope_allows
from core.users.functions import user_has_access_to_api
from core.users.model import UserDTO
from graphql_api.helpers import mask_sensitive_values
from graphql_api.modules.log.subscriptions import _authenticate_subscription

logger = logging.getLogger(__name__)


# Event entity names that are not API names themselves
_EVENT_ENTITY_API = {
    "integration_validation_request": "integration",
    "integration_validation_response": "integration",
}


async def _can_read(user: UserDTO, entity_name: str) -> bool:
    entity_name = _EVENT_ENTITY_API.get(entity_name, entity_name)
    if not scope_allows(get_current_token_scopes(), "read", entity_name):
        return False
    return await user_has_access_to_api(user, entity_name, "read")


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

        user = await _authenticate_subscription(info)
        if user.deactivated is True:
            raise PermissionError("User account is deactivated")

        logger.info("GraphQL subscription: listening for event stream messages")
        async with pubsub.hub.subscribe(pubsub.EVENTS_TOPIC) as messages:
            async for message in messages:
                msg: dict[str, Any] = dict(message)
                metadata = msg.pop("_metadata", {})

                # The topic carries every entity change plus internal reload signals:
                # forward only entities the subscriber may read, like the list queries do.
                entity_name = msg.get("_entity_name")
                if not entity_name or not await _can_read(user, str(entity_name)):
                    continue

                yield EventStreamMessage(
                    event=str(metadata.get("event", "")),
                    payload=JSON(mask_sensitive_values(msg)),
                    entity_id=str(msg.get("id")) if msg.get("id") is not None else None,
                    entity_name=str(msg.get("_entity_name")) if msg.get("_entity_name") else None,
                    trace_id=str(metadata.get("trace_id")) if metadata.get("trace_id") else None,
                    audit_log_id=str(metadata.get("audit_log_id")) if metadata.get("audit_log_id") else None,
                )
