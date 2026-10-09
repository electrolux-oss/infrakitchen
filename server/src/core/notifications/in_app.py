from typing import Any
from uuid import UUID

from sqlalchemy import insert
from sqlalchemy.ext.asyncio import AsyncSession

import core.pubsub as pubsub
from core.constants.model import EventType
from core.db_engine import engine
from core.utils.model_tools import is_valid_uuid

from .model import UserNotification


async def store_in_app_notification(msg: dict[str, Any]) -> dict[str, Any]:
    """Persist an in-app notification in the user's inbox and return the message enriched with its ID.

    Uses a plain ``AsyncSession``, like ``enqueue_notifications``, so task queue code can
    call it without importing the request-scoped session machinery.
    """
    entity_id = msg.get("entity_id")
    statement = (
        insert(UserNotification)
        .values(
            user_id=UUID(str(msg["user_id"])),
            event_type=msg.get("event_type") or EventType.UPDATE,
            entity_type=msg.get("entity_type") or "",
            entity_id=UUID(str(entity_id)) if entity_id and is_valid_uuid(entity_id) else None,
            entity_name=str(msg["entity_name"])[:255] if msg.get("entity_name") else None,
            title=str(msg["title"])[:255] if msg.get("title") else None,
            message=msg.get("msg") or "",
            status=msg.get("status") or "info",
        )
        .returning(UserNotification.id, UserNotification.created_at)
    )
    async with AsyncSession(engine) as session:
        notification_id, created_at = (await session.execute(statement)).one()
        await session.commit()
    return {**msg, "id": str(notification_id), "created_at": created_at.isoformat()}


async def deliver_in_app_notification(msg: dict[str, Any]) -> None:
    """Store the notification in the user's inbox, then stream it to the user's open sessions."""
    stored_msg = await store_in_app_notification(msg)
    await pubsub.publish(pubsub.in_app_notifications_topic(msg["user_id"]), stored_msg)
