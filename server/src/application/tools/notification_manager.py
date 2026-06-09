import asyncio
import json
import logging
from typing import Any, cast

import aio_pika

from application.integrations.model import Integration
from core.dependencies import get_async_session
from core.rabbitmq import RabbitMQConnection

from application.providers import NotificationProviderAdapter
from application.integrations.dependencies import get_integration_service

logger = logging.getLogger(__name__)


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

    # in_app is handled by the GraphQL subscription consumer
    if provider == "in_app":
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


async def notification_provider_consumer() -> None:
    """RabbitMQ consumer that dispatches notification messages to external providers.

    Listens on ``ik_notification_messages`` exchange with routing key ``notifications.#``
    and uses the ``provider`` field in the message body to dynamically resolve the correct
    NotificationProviderAdapter from the adapter registry.
    """
    async with RabbitMQConnection() as connection:
        channel = await connection.get_channel()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")

        await channel.set_qos(prefetch_count=1)

        notification_exchange = await channel.declare_exchange(
            "ik_notification_messages",
            aio_pika.ExchangeType.TOPIC,
            auto_delete=False,
            durable=True,
        )

        queue = await channel.declare_queue(
            "notification_provider_consumer",
            durable=True,
            auto_delete=False,
        )
        await queue.bind(notification_exchange, routing_key="notification_provider_consumer.#")

        logger.info("Notification provider watcher started, bound to notifications.#")

        async def on_message(message: aio_pika.abc.AbstractIncomingMessage) -> None:
            async with message.process(ignore_processed=True):
                try:
                    msg: dict[str, Any] = json.loads(message.body.decode())
                    msg.pop("_metadata", None)
                    await _dispatch_notification(msg)
                except Exception as e:
                    logger.error(f"Failed to process notification message: {e}", exc_info=True)

        consumer_tag = await queue.consume(on_message)

        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            if consumer_tag:
                await queue.cancel(consumer_tag)
            raise


async def start_notification_provider_consumer() -> None:
    """Start the notification provider consumer with auto-restart on failure."""
    try:
        await notification_provider_consumer()
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error(f"Notification provider consumer stopped unexpectedly: {e}, restarting in 5 seconds")
        await asyncio.sleep(5)
        await start_notification_provider_consumer()
