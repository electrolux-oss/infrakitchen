import uuid
from typing import Any

from core.constants.model import EventType
from core.notifications.in_app import deliver_in_app_notification
from core.notifications.text import action_label, entity_reference, notification_message, notification_title

from .model import SupersededTask


async def _send_in_app(user_id: uuid.UUID, title: str, message: str, task: SupersededTask) -> None:
    """Deliver an in-app notification straight to one user, bypassing subscriptions:
    the user acted on the entity themselves, so they should know regardless of what they follow."""
    body: dict[str, Any] = {
        "msg": message,
        "title": title,
        "status": "warning",
        "event_type": str(EventType.EXECUTE),
        "entity_type": task.entity,
        "entity_id": str(task.entity_id),
        "entity_name": None,
        "provider": "in_app",
        "user_id": str(user_id),
    }
    await deliver_in_app_notification(body)


async def notify_superseded(task: SupersededTask) -> None:
    """Tell the new requester (and the previous one, if different) that a queued action was replaced."""
    entity = entity_reference(task.entity, entity_id=task.entity_id)
    title = notification_title(task.entity, "action replaced")
    queued, newer = action_label(task.action), action_label(task.replaced_by_action)

    if task.replaced_by_user is not None:
        await _send_in_app(
            task.replaced_by_user,
            title,
            notification_message(f"The queued {queued} for {entity} was cancelled and replaced by your {newer}"),
            task,
        )

    if task.created_by is not None and task.created_by != task.replaced_by_user:
        await _send_in_app(
            task.created_by,
            title,
            notification_message(f"Your queued {queued} for {entity} was cancelled and replaced by a newer {newer}"),
            task,
        )
