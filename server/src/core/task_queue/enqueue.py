import logging
import uuid
from datetime import timedelta
from typing import Any

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.db_engine import engine

from .model import TASK_QUEUE_CHANNEL, SupersededTask, TaskQueueItem, TaskQueueStatus
from .notifications import notify_superseded

logger = logging.getLogger(__name__)

# Delivered by Postgres when the surrounding transaction commits
NOTIFY_STATEMENT = text(f"SELECT pg_notify('{TASK_QUEUE_CHANNEL}', '')")


def supersede_key(item: dict[str, Any]) -> tuple[str, uuid.UUID, str] | None:
    """Tasks with the same key replace each other while still queued.

    Workflow tasks targeting a specific step are distinct work, so the step is part of the key.
    Tasks without an entity (scheduler jobs) are never superseded.
    """
    entity_id = item.get("entity_id")
    if entity_id is None:
        return None
    step_id = (item.get("payload") or {}).get("step_id") or ""
    return item["entity"], entity_id, str(step_id)


def collapse_batch(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only the last task per supersede key within one batch, preserving order."""
    last_index = {key: i for i, item in enumerate(items) if (key := supersede_key(item)) is not None}
    return [item for i, item in enumerate(items) if (key := supersede_key(item)) is None or last_index[key] == i]


async def cancel_queued(session: AsyncSession, item: dict[str, Any]) -> list[SupersededTask]:
    """Cancel tasks with the same key that no worker has claimed yet."""
    key = supersede_key(item)
    if key is None:
        return []
    entity, entity_id, step_id = key
    statement = (
        update(TaskQueueItem)
        .where(
            TaskQueueItem.status == TaskQueueStatus.QUEUED,
            TaskQueueItem.entity == entity,
            TaskQueueItem.entity_id == entity_id,
            func.coalesce(TaskQueueItem.payload["step_id"].as_string(), "") == step_id,
        )
        .values(
            status=TaskQueueStatus.CANCELLED,
            finished_at=func.now(),
            error=f"Superseded by task {item['id']} ({item.get('action')})",
        )
        .returning(TaskQueueItem.id, TaskQueueItem.action, TaskQueueItem.created_by)
    )
    rows = (await session.execute(statement)).all()
    return [
        SupersededTask(
            id=row.id,
            action=row.action,
            created_by=row.created_by,
            entity=entity,
            entity_id=entity_id,
            replaced_by_action=item.get("action"),
            replaced_by_user=item.get("created_by"),
        )
        for row in rows
    ]


def to_row(item: dict[str, Any]) -> TaskQueueItem:
    """Build a queue row; an item's ``delay_seconds`` holds it back from workers for that long."""
    values = dict(item)
    delay_seconds = values.pop("delay_seconds", 0) or 0
    if delay_seconds > 0:
        # Database time, the same clock workers compare against when claiming
        values["available_at"] = func.now() + timedelta(seconds=delay_seconds)
    return TaskQueueItem(**values)


async def enqueue_tasks(items: list[dict[str, Any]]) -> None:
    """Insert tasks into the queue and wake up listening workers.

    A new task replaces any still-queued task for the same entity, so actions a user
    repeats while no worker is available run once, with the latest request. Running
    tasks are never touched; the new task waits for them (one running task per entity).

    Uses a plain ``AsyncSession`` on purpose: this is called while EventSenders are
    being flushed, and ``EventFlushingSession`` would flush them again on commit.
    Depends only on the engine and the model so EventSender can import it without
    an import cycle through ``core.database``.
    """
    if not items:
        return
    items = [{**item, "id": item.get("id") or uuid.uuid4()} for item in collapse_batch(items)]
    superseded: list[SupersededTask] = []
    async with AsyncSession(engine, expire_on_commit=False) as session:
        # Serialize concurrent enqueues for the same key so two simultaneous requests can't
        # both miss each other's queued task. Sorted to avoid deadlocks between batches.
        keys = sorted({"/".join(map(str, key)) for item in items if (key := supersede_key(item)) is not None})
        for key in keys:
            _ = await session.execute(select(func.pg_advisory_xact_lock(func.hashtextextended(key, 0))))
        for item in items:
            superseded.extend(await cancel_queued(session, item))
        session.add_all([to_row(item) for item in items])
        _ = await session.execute(NOTIFY_STATEMENT)
        await session.commit()

    for task in superseded:
        logger.info(f"Task {task.id} ({task.entity} {task.entity_id} {task.action}) superseded by a newer request")
        try:
            await notify_superseded(task)
        except Exception as e:
            logger.error(f"Failed to notify about superseded task {task.id}: {e}")
