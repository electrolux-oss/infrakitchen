from typing import Any
from uuid import UUID

from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

import core.pubsub as pubsub
from core.constants.model import EventType
from core.db_engine import engine
from core.users.accounts import get_primary_account_ids
from core.utils.model_tools import is_valid_uuid

from .model import UserNotification


def _to_row(msg: dict[str, Any], user_id: UUID, outbox_id: UUID | None) -> dict[str, Any]:
    entity_id = msg.get("entity_id")
    return {
        "user_id": user_id,
        "outbox_id": outbox_id,
        "event_type": msg.get("event_type") or EventType.UPDATE,
        "entity_type": msg.get("entity_type") or "",
        "entity_id": UUID(str(entity_id)) if entity_id and is_valid_uuid(entity_id) else None,
        "entity_name": str(msg["entity_name"])[:255] if msg.get("entity_name") else None,
        "title": str(msg["title"])[:255] if msg.get("title") else None,
        "message": msg.get("msg") or "",
        "status": msg.get("status") or "info",
    }


async def deliver_in_app_notifications(messages: list[dict[str, Any]], outbox_id: UUID | None = None) -> None:
    """Store one event's notifications in the recipients' inboxes, then stream them to their open sessions.

    Recipients are resolved to their primary account, so a user reached through several linked
    accounts gets the event once, on the topic the UI listens to.
    With ``outbox_id``, a retried outbox item skips the recipients it already reached.
    Uses a plain ``AsyncSession``, like ``enqueue_notifications``, so task queue code can
    call it without importing the request-scoped session machinery.
    """
    if not messages:
        return

    async with AsyncSession(engine) as session:
        primary_ids = await get_primary_account_ids(session, {UUID(str(msg["user_id"])) for msg in messages})

        by_recipient: dict[UUID, dict[str, Any]] = {}
        for msg in messages:
            user_id = UUID(str(msg["user_id"]))
            recipient_id = primary_ids.get(user_id, user_id)
            _ = by_recipient.setdefault(recipient_id, {**msg, "user_id": str(recipient_id)})

        statement = (
            pg_insert(UserNotification)
            .values([_to_row(msg, recipient_id, outbox_id) for recipient_id, msg in by_recipient.items()])
            .on_conflict_do_nothing(
                index_elements=[UserNotification.outbox_id, UserNotification.user_id],
                index_where=text("outbox_id IS NOT NULL"),
            )
            .returning(UserNotification.id, UserNotification.user_id, UserNotification.created_at)
        )
        rows = (await session.execute(statement)).all()
        await session.commit()

    await pubsub.publish_many(
        (
            pubsub.in_app_notifications_topic(row.user_id),
            {**by_recipient[row.user_id], "id": str(row.id), "created_at": row.created_at.isoformat()},
        )
        for row in rows
    )


async def deliver_in_app_notification(msg: dict[str, Any]) -> None:
    await deliver_in_app_notifications([msg])
