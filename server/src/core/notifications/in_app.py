from typing import Any
from uuid import UUID

from sqlalchemy import insert, select
from sqlalchemy.ext.asyncio import AsyncSession

import core.pubsub as pubsub
from core.constants.model import EventType
from core.db_engine import engine
from core.users.model import user_account_associations
from core.utils.model_tools import is_valid_uuid

from .model import UserNotification


def _to_row(msg: dict[str, Any], user_id: UUID) -> dict[str, Any]:
    entity_id = msg.get("entity_id")
    return {
        "user_id": user_id,
        "event_type": msg.get("event_type") or EventType.UPDATE,
        "entity_type": msg.get("entity_type") or "",
        "entity_id": UUID(str(entity_id)) if entity_id and is_valid_uuid(entity_id) else None,
        "entity_name": str(msg["entity_name"])[:255] if msg.get("entity_name") else None,
        "title": str(msg["title"])[:255] if msg.get("title") else None,
        "message": msg.get("msg") or "",
        "status": msg.get("status") or "info",
    }


async def _primary_account_ids(session: AsyncSession, user_ids: set[UUID]) -> dict[UUID, UUID]:
    """Map linked secondary accounts to their primary account."""
    statement = select(
        user_account_associations.c.secondary_user_id, user_account_associations.c.primary_user_id
    ).where(user_account_associations.c.secondary_user_id.in_(user_ids))
    return {secondary: primary for secondary, primary in (await session.execute(statement)).all()}


async def deliver_in_app_notifications(messages: list[dict[str, Any]]) -> None:
    """Store one event's notifications in the recipients' inboxes, then stream them to their open sessions.

    Recipients are resolved to their primary account, so a user reached through several linked
    accounts gets the event once, on the topic the UI listens to.
    Uses a plain ``AsyncSession``, like ``enqueue_notifications``, so task queue code can
    call it without importing the request-scoped session machinery.
    """
    if not messages:
        return

    async with AsyncSession(engine) as session:
        primary_ids = await _primary_account_ids(session, {UUID(str(msg["user_id"])) for msg in messages})

        by_recipient: dict[UUID, dict[str, Any]] = {}
        for msg in messages:
            user_id = UUID(str(msg["user_id"]))
            recipient_id = primary_ids.get(user_id, user_id)
            _ = by_recipient.setdefault(recipient_id, {**msg, "user_id": str(recipient_id)})
        to_store = list(by_recipient.values())

        statement = insert(UserNotification).returning(
            UserNotification.id, UserNotification.created_at, sort_by_parameter_order=True
        )
        rows = (await session.execute(statement, [_to_row(msg, UUID(msg["user_id"])) for msg in to_store])).all()
        await session.commit()

    await pubsub.publish_many(
        (
            pubsub.in_app_notifications_topic(msg["user_id"]),
            {**msg, "id": str(row.id), "created_at": row.created_at.isoformat()},
        )
        for msg, row in zip(to_store, rows, strict=True)
    )


async def deliver_in_app_notification(msg: dict[str, Any]) -> None:
    await deliver_in_app_notifications([msg])
