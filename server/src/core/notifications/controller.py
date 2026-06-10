from dataclasses import dataclass
import logging
from typing import Any
from aio_pika import ExchangeType
from core.base_models import MessageModel
from core.rabbitmq import RabbitMQConnection

logger = logging.getLogger(__name__)


@dataclass
class NotificationEvent:
    event_type: str
    entity_type: str
    title: str
    status: str
    message: str
    entity_id: str | None = None
    metadata: dict[str, Any] | None = None


async def publish_notification_event(event: NotificationEvent) -> None:
    """Publish a raw notification event to the ik_raw_messages exchange."""
    body: dict[str, Any] = {
        "event_type": event.event_type,
        "entity_type": event.entity_type,
        "entity_id": event.entity_id,
        "title": event.title,
        "message": event.message,
        "status": event.status,
        "metadata": event.metadata,
    }
    message = MessageModel(
        body=body,
        message_type="event",
        exchange="ik_raw_messages",
        routing_key="notification_event_router",
        exchange_type=ExchangeType.TOPIC,
    )
    logger.debug(f"Publishing notification event: entity_type={event.entity_type} entity_id={event.entity_id}")
    await RabbitMQConnection.send_message(message)
