import logging
from typing import Any

from aio_pika import ExchangeType

from core import MessageModel, RabbitMQConnection

logger = logging.getLogger("user_entity_notification")


def create_message(body: dict[str, Any], entity_name: str, user_id: str) -> MessageModel:
    routing_key = f"notifications.{entity_name}.{user_id}"
    logger.debug(
        f"Creating notification message with routing_key: {routing_key} (entity_name={entity_name}, user_id={user_id})"
    )

    message = MessageModel(
        body=body,
        message_type="notification",
        exchange="ik_raw_messages",
        routing_key=routing_key,
        exchange_type=ExchangeType.TOPIC,
    )
    return message


async def send_message(message: MessageModel):
    logger.debug(f"Sending notification message: {message}")
    await RabbitMQConnection.send_message(message)
