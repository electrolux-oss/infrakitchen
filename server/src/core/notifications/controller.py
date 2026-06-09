from dataclasses import dataclass
import logging
from typing import Any, cast
from uuid import UUID
from aio_pika import ExchangeType
from sqlalchemy.ext.asyncio import AsyncSession
from .dependencies import get_notification_preference_service, get_subscription_service
from .model import NotificationChannel, Subscription
from .service import NotificationPreferenceService, SubscriptionService
from core.base_models import MessageModel
from core.database import FieldSpec
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


def create_message(body: dict[str, Any]) -> MessageModel:
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

    message = MessageModel(
        body=body,
        message_type="notification",
        exchange="ik_notification_messages",
        routing_key=routing_key,
        exchange_type=ExchangeType.TOPIC,
    )
    return message


async def send_message(message: MessageModel):
    logger.debug(f"Sending notification message: {message}")
    await RabbitMQConnection.send_message(message)


class NotificationController:
    """Routes notifications to the appropriate channels based on user preferences."""

    def __init__(self, session: AsyncSession):
        self.session = session
        self.subscription_service: SubscriptionService = get_subscription_service(session)
        self.preference_service: NotificationPreferenceService = get_notification_preference_service(session=session)

    async def _get_subscriptions_for_event(self, event: NotificationEvent) -> list[Subscription]:
        """Retrieve all subscriptions matching the entity, including wildcard (entity_id=None) subscriptions."""
        fields: FieldSpec = {
            "entity_type": None,
            "entity_id": None,
            "user": cast(FieldSpec, {"id": None, "meta": None, "deactivated": None}),
        }
        specific = await self.subscription_service.query_all(
            filter={"entity_type": event.entity_type, "entity_id": event.entity_id}, fields=fields
        )
        wildcard = await self.subscription_service.query_all(
            filter={"entity_type": event.entity_type, "entity_id": None}, fields=fields
        )

        seen_user_ids: set[str] = set()
        combined: list[Subscription] = []
        for sub in specific + wildcard:
            uid = str(sub.user_id)
            if uid not in seen_user_ids:
                seen_user_ids.add(uid)
                if sub.user.deactivated:
                    logger.debug(f"Skipping deactivated user {uid} for subscription {sub.id}")
                    continue
                combined.append(sub)

        return combined

    async def route_notification(self, event: NotificationEvent) -> None:
        """Route a notification event to all subscribed users based on their preferences."""
        subscriptions = await self._get_subscriptions_for_event(event)
        if not subscriptions:
            logger.debug(f"No subscriptions found for {event.entity_type}:{event.entity_id}")
            return None

        user_ids: set[UUID] = set(sub.user_id for sub in subscriptions if sub.user_id is not None)

        preference_fields: FieldSpec = {
            "user": cast(FieldSpec, {"id": None, "meta": None}),
            "channels": None,
        }

        all_preferences = await self.preference_service.query_all(
            filter={"user_id__in": list(user_ids), "event_type": event.event_type},
            fields=preference_fields,
        )

        for preference in all_preferences:
            user_id = preference.user_id

            for channel in [NotificationChannel(c) for c in preference.channels]:
                body = {
                    "msg": event.message,
                    "title": event.title,
                    "status": event.status,
                    "entity_id": str(event.entity_id) if event.entity_id is not None else None,
                    "entity_name": event.entity_type,
                    "provider": channel.value.lower(),
                    "user_id": str(user_id),
                }

                user_meta = preference.user.meta
                if channel == NotificationChannel.SLACK:
                    slack_id = (
                        user_meta.get("slack_id")
                        if isinstance(user_meta, dict)
                        else getattr(user_meta, "slack_id", None)
                    )
                    if not slack_id:
                        logger.debug(f"User {user_id} prefers Slack but has no slack_id, skipping")
                        continue

                    body.update({"channel": slack_id})

                try:
                    notification_message = create_message(body)
                    await send_message(notification_message)
                    logger.info(f"Notification sent to user {user_id} via {channel.value}")
                except Exception as e:
                    logger.error(f"Failed to notify user {user_id} via {channel.value}: {e}", exc_info=True)
