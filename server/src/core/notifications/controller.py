import logging

from . import outbox
from .model import NotificationEvent

logger = logging.getLogger(__name__)

__all__ = ["NotificationEvent", "publish_notification_event"]


async def publish_notification_event(event: NotificationEvent) -> None:
    """Store a notification event in the outbox; a dispatcher routes it to subscribers.

    Writes in its own transaction, so call it once the change it reports is committed.
    Request-scoped code should use ``EventSender.send_notification`` instead, which
    buffers the event until the request's session commits.
    """
    logger.debug(f"Publishing notification event: entity_type={event.entity_type} entity_id={event.entity_id}")
    await outbox.enqueue_notifications([event])
