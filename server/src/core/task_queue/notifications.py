import uuid
from typing import Any

import core.pubsub as pubsub

from .model import SupersededTask


def _label(entity: str) -> str:
    return entity.replace("_", " ").capitalize()


async def _send_in_app(user_id: uuid.UUID, title: str, message: str, task: SupersededTask) -> None:
    """Deliver an in-app notification straight to one user, bypassing subscriptions:
    the user acted on the entity themselves, so they should know regardless of what they follow."""
    body: dict[str, Any] = {
        "msg": message,
        "title": title,
        "status": "warning",
        "entity_id": str(task.entity_id),
        "entity_name": task.entity,
        "provider": "in_app",
        "user_id": str(user_id),
    }
    await pubsub.publish(pubsub.in_app_notifications_topic(user_id), body)


async def notify_superseded(task: SupersededTask) -> None:
    """Tell the new requester (and the previous one, if different) that a queued action was replaced."""
    label = _label(task.entity)
    title = f"{label} action already queued"

    if task.replaced_by_user is not None:
        await _send_in_app(
            task.replaced_by_user,
            title,
            f"{label} {task.entity_id} already had '{task.action}' waiting for a worker. "
            + f"It was cancelled and replaced by your '{task.replaced_by_action}'.",
            task,
        )

    if task.created_by is not None and task.created_by != task.replaced_by_user:
        await _send_in_app(
            task.created_by,
            title,
            f"Your queued '{task.action}' for {label.lower()} {task.entity_id} was cancelled "
            + f"and replaced by a newer '{task.replaced_by_action}' request.",
            task,
        )
