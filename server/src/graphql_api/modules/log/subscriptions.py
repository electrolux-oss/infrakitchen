import json
import logging
from collections.abc import AsyncGenerator
from typing import Any

import aio_pika
import strawberry
from strawberry.types import Info

from core.config import InfrakitchenConfig
from core.rabbitmq import RabbitMQConnection
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

        The subscription binds an exclusive RabbitMQ queue to the
        ``logs.<entity_name>.<entity_id>`` routing key and yields each
        message as a typed ``LogStreamMessage``.  The queue and exchange
        binding are cleaned up automatically when the client disconnects.
        """
        if InfrakitchenConfig().websocket is False:
            raise PermissionError("WebSocket subscriptions are disabled")

        await _authenticate_subscription(info)

        if not entity_name or not entity_id:
            raise ValueError("entity_name and entity_id are required")

        routing_key = f"logs.{entity_name}.{entity_id}"

        async with RabbitMQConnection() as connection:
            channel = await connection.get_channel()
            if channel is None:
                raise RuntimeError("Failed to create RabbitMQ channel")

            try:
                raw_messages_exchange = await channel.declare_exchange(
                    "ik_raw_messages",
                    aio_pika.ExchangeType.TOPIC,
                    auto_delete=False,
                    durable=True,
                )

                log_exchange = await channel.declare_exchange(
                    f"ik_log_messages_{entity_id}",
                    aio_pika.ExchangeType.FANOUT,
                    auto_delete=True,
                    durable=True,
                )

                await log_exchange.bind(raw_messages_exchange, routing_key=routing_key)

                queue = await channel.declare_queue(exclusive=True, auto_delete=True)
                await queue.bind(log_exchange)

                logger.info("GraphQL subscription: listening on %s", routing_key)

                async with queue.iterator(no_ack=True) as queue_iter:
                    async for message in queue_iter:
                        msg: dict[str, Any] = json.loads(message.body.decode())
                        msg.pop("_metadata", None)

                        yield LogStreamMessage(
                            entity_id=str(msg.get("entity_id", entity_id)),
                            entity=msg.get("entity", entity_name),
                            level=msg.get("level", "info"),
                            data=msg.get("data", ""),
                            revision=msg.get("revision", 1),
                            execution_start=msg.get("execution_start", 1),
                            audit_log_id=str(v) if (v := msg.get("audit_log_id")) else None,
                            created_at=str(v) if (v := msg.get("created_at")) else None,
                            trace_id=str(v) if (v := msg.get("trace_id")) else None,
                        )
            finally:
                logger.debug("GraphQL subscription: cleaned up log stream for %s", entity_id)
