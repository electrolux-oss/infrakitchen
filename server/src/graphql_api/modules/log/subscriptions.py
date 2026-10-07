import logging
from collections.abc import AsyncGenerator

import strawberry
from strawberry.types import Info

import core.pubsub as pubsub
from core.config import InfrakitchenConfig
from core.sso.functions import get_user_from_token
from core.users.model import UserDTO

logger = logging.getLogger(__name__)


async def _authenticate_subscription(info: Info) -> UserDTO:
    """Authenticate the GraphQL WS ``connection_init`` token.

    Clients must send ``{"type": "connection_init", "payload": {"token": "<token>"}}``
    when opening the WebSocket. The token is resolved through the same shared
    auth path as HTTP requests, so JWTs and personal access tokens behave the same.

    Raises:
        PermissionError: If the token is missing or invalid.
    """
    connection_params: dict[str, str] = info.context.get("connection_params") or {}  # type: ignore[assignment]
    token = connection_params.get("token")
    if not token:
        raise PermissionError("Authentication required: send token in connection_init payload")

    service = info.context.get("sso_service")
    if service is None:
        raise PermissionError("Authentication service unavailable")

    try:
        user = await get_user_from_token(service, token)
    except Exception as error:
        raise PermissionError("Invalid authentication token") from error

    info.context["user"] = user
    request = info.context.get("request")
    if request is not None and hasattr(request, "state"):
        request.state.user = user

    return user


@strawberry.type
class LogStreamMessage:
    """A single log entry streamed from the execution pipeline."""

    entity_id: str
    entity: str
    level: str
    data: str
    revision: int
    execution_start: int
    audit_log_id: str | None = None
    created_at: str | None = None
    trace_id: str | None = None


@strawberry.type
class LogSubscription:
    @strawberry.subscription
    async def log_stream(
        self,
        info: Info,
        entity_name: str,
        entity_id: str,
    ) -> AsyncGenerator[LogStreamMessage, None]:
        """Subscribe to real-time log messages for a specific entity.

        Listens on the ``logs.<entity_name>.<entity_id>`` pubsub topic, where
        ``EntityLogger`` publishes saved lines in batches, and yields each line
        as a typed ``LogStreamMessage``.
        """
        if InfrakitchenConfig().websocket is False:
            raise PermissionError("WebSocket subscriptions are disabled")

        await _authenticate_subscription(info)

        if not entity_name or not entity_id:
            raise ValueError("entity_name and entity_id are required")

        topic = pubsub.logs_topic(entity_name, entity_id)
        logger.info("GraphQL subscription: listening on %s", topic)
        try:
            async with pubsub.hub.subscribe(topic) as batches:
                async for batch in batches:
                    for line in batch.get("lines", []):
                        yield LogStreamMessage(
                            entity_id=str(batch.get("entity_id", entity_id)),
                            entity=batch.get("entity", entity_name),
                            level=line.get("level", "info"),
                            data=line.get("data", ""),
                            revision=batch.get("revision", 1),
                            execution_start=batch.get("execution_start", 1),
                            audit_log_id=batch.get("audit_log_id"),
                            created_at=line.get("created_at"),
                            trace_id=batch.get("trace_id"),
                        )
        finally:
            logger.debug("GraphQL subscription: cleaned up log stream for %s", entity_id)
