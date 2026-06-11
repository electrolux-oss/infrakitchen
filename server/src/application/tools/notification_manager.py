import asyncio
import json
import logging
from typing import Any, cast
from uuid import UUID

import aio_pika
from aio_pika import ExchangeType
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from core.base_models import MessageModel
from core.database import FieldSpec
from core.dependencies import get_async_session
from core.rabbitmq import RabbitMQConnection

from application.providers import NotificationProviderAdapter
from application.integrations.dependencies import get_integration_service
from core.notifications.controller import NotificationEvent
from core.notifications.dependencies import get_notification_preference_service, get_subscription_service
from core.notifications.model import NotificationChannel

logger = logging.getLogger(__name__)


def create_in_app_message(body: dict[str, Any]) -> MessageModel:
    notification_provider = body.get("provider")
    user_id = body.get("user_id")
    if not notification_provider or not user_id:
        raise ValueError("Message body must contain 'provider' and 'user_id' fields")

    if notification_provider == "in_app":
        routing_key = f"notifications.in_app.{user_id}"
    else:
        routing_key = f"notification_provider_consumer.{notification_provider}.{user_id}"

    logger.debug(
        f"Creating notification message with routing_key: {routing_key} "
        f"(entity_name={notification_provider}, user_id={user_id})"
    )

    return MessageModel(
        body=body,
        message_type="notification",
        exchange="ik_notification_messages",
        routing_key=routing_key,
        exchange_type=ExchangeType.TOPIC,
    )


async def send_message(message: MessageModel) -> None:
    logger.debug(f"Sending notification message: {message}")
    await RabbitMQConnection.send_message(message)


async def _get_provider_integration(provider: str) -> Integration | None:
    """Resolve the integration configuration for an external notification provider."""

    async with get_async_session() as session:
        service = get_integration_service(session=session)
        integrations = await service.query_all(
            filter={"integration_provider": provider}, fields={"configuration": None}
        )
        if not integrations:
            return None

        if len(integrations) > 1:
            logger.warning(f"Multiple integrations found for provider '{provider}', using the first one")
        return integrations[0]


async def _dispatch_notification(msg: dict[str, Any]) -> None:
    """Dispatch a single notification message to the appropriate provider adapter."""

    provider = msg.get("provider")
    user_id = msg.get("user_id")

    if not provider or not user_id:
        logger.warning(f"Message missing provider or user_id: {msg}")
        return

    if provider == "in_app":
        await send_message(create_in_app_message(msg))
        return

    adapter_cls: type[NotificationProviderAdapter] | None = NotificationProviderAdapter.notification_adapters.get(
        provider
    )
    if not adapter_cls:
        logger.warning(f"No notification provider adapter registered for: {provider}")
        return

    integration = await _get_provider_integration(provider)
    if not integration or not integration.configuration:
        logger.error(f"No integration found for provider '{provider}', cannot send notification")
        return

    adapter_instance = cast(Any, adapter_cls)(configuration=integration.configuration)
    await adapter_instance.authenticate()
    await adapter_instance.send_notification(**msg)


async def _route_notification_event(event: NotificationEvent, session: AsyncSession) -> None:
    """Resolve subscriptions and preferences for an event and dispatch per-user-per-channel messages.

    - IN_APP: publishes to ``ik_notification_messages`` for the GraphQL WebSocket consumer.
    - External providers (e.g. Slack): dispatches directly via the registered adapter.
    """
    subscription_service = get_subscription_service(session)
    preference_service = get_notification_preference_service(session=session)

    sub_fields: FieldSpec = {
        "entity_type": None,
        "entity_id": None,
        "user": cast(FieldSpec, {"id": None, "meta": None, "deactivated": None}),
    }
    specific = await subscription_service.query_all(
        filter={"entity_type": event.entity_type, "entity_id": event.entity_id}, fields=sub_fields
    )
    wildcard = await subscription_service.query_all(
        filter={"entity_type": event.entity_type, "entity_id": None}, fields=sub_fields
    )

    seen_user_ids: set[str] = set()
    subscriptions = []
    for sub in specific + wildcard:
        uid = str(sub.user_id)
        if uid not in seen_user_ids:
            seen_user_ids.add(uid)
            if sub.user.deactivated:
                logger.debug(f"Skipping deactivated user {uid} for subscription {sub.id}")
                continue
            subscriptions.append(sub)

    if not subscriptions:
        logger.debug(f"No subscriptions found for {event.entity_type}:{event.entity_id}")
        return

    user_ids: set[UUID] = {sub.user_id for sub in subscriptions if sub.user_id is not None}

    pref_fields: FieldSpec = {
        "user": cast(FieldSpec, {"id": None, "meta": None}),
        "channels": None,
    }
    all_preferences = await preference_service.query_all(
        filter={"user_id__in": list(user_ids), "event_type": event.event_type},
        fields=pref_fields,
    )

    for preference in all_preferences:
        user_id = preference.user_id
        for channel in [NotificationChannel(c) for c in preference.channels]:
            body: dict[str, Any] = {
                "msg": event.message,
                "title": event.title,
                "status": event.status,
                "entity_id": str(event.entity_id) if event.entity_id is not None else None,
                "entity_name": event.entity_type,
                "provider": channel.value.lower(),
                "user_id": str(user_id),
            }

            if channel == NotificationChannel.SLACK:
                user_meta = preference.user.meta
                slack_id = (
                    user_meta.get("slack_id") if isinstance(user_meta, dict) else getattr(user_meta, "slack_id", None)
                )
                if not slack_id:
                    logger.debug(f"User {user_id} prefers Slack but has no slack_id, skipping")
                    continue
                body["channel"] = slack_id

            try:
                await _dispatch_notification(body)
                logger.info(f"Notification dispatched to user {user_id} via {channel.value}")
            except Exception as e:
                logger.error(f"Failed to notify user {user_id} via {channel.value}: {e}", exc_info=True)


async def notification_event_router() -> None:
    """RabbitMQ consumer that routes raw notification events to per-user-per-channel messages.

    Listens on ``ik_raw_messages`` exchange. For each event it opens a fresh DB
    session, resolves subscriptions and user preferences via ``_route_notification_event``,
    and dispatches the resulting per-user messages to provider adapters or ``ik_notification_messages``.
    """
    async with RabbitMQConnection() as connection:
        channel = await connection.get_channel()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")

        await channel.set_qos(prefetch_count=1)

        events_exchange = await channel.declare_exchange(
            "ik_raw_messages",
            aio_pika.ExchangeType.TOPIC,
            auto_delete=False,
            durable=True,
        )

        queue = await channel.declare_queue(
            "notification_event_router",
            durable=True,
            auto_delete=False,
        )
        await queue.bind(events_exchange, routing_key="notification_event_router.#")

        logger.info("Notification event router started, bound to notification_event_router.#")

        async def on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
            async with message.process(ignore_processed=True):
                try:
                    body: dict[str, Any] = json.loads(message.body.decode())
                    body.pop("_metadata", None)

                    event = NotificationEvent(
                        event_type=body["event_type"],
                        entity_type=body["entity_type"],
                        entity_id=body.get("entity_id"),
                        title=body["title"],
                        message=body["message"],
                        status=body["status"],
                        metadata=body.get("metadata"),
                    )

                    async with get_async_session() as session:
                        await _route_notification_event(event, session)
                except Exception as e:
                    logger.error(f"Failed to route notification event: {e}", exc_info=True)

        consumer_tag = await queue.consume(on_message)

        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            if consumer_tag:
                await queue.cancel(consumer_tag)
            raise


async def start_notification_event_router() -> None:
    """Start the notification event router with auto-restart on failure."""
    try:
        await notification_event_router()
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error(f"Notification event router stopped unexpectedly: {e}, restarting in 5 seconds")
        await asyncio.sleep(5)
        await start_notification_event_router()
