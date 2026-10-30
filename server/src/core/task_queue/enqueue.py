import logging
import uuid
from collections.abc import Iterable
from datetime import timedelta
from typing import Any

from sqlalchemy import ColumnElement, func, literal, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

import core.pubsub as pubsub
from core.db_engine import engine

from .model import TASK_QUEUE_CHANNEL, SupersededTask, TaskQueueItem, TaskQueueStatus
from .notifications import notify_superseded
from .routing import resolve_targets

logger = logging.getLogger(__name__)

# Delivered by Postgres when the surrounding transaction commits
NOTIFY_STATEMENT = text(f"SELECT pg_notify('{TASK_QUEUE_CHANNEL}', '')")

QUEUE_ITEM_EVENT = "task_queue_item"
# What the UI needs to keep its queue list current; the task payload stays on the server
QUEUE_ITEM_FIELDS = (
    "id",
    "entity",
    "entity_id",
    "action",
    "status",
    "created_at",
    "available_at",
    "started_at",
    "retries",
    "max_retries",
    "created_by",
    "worker_id",
    "worker_template_id",
)


def queue_item_event(item: Any, **overrides: Any) -> dict[str, Any]:
    """Event stream message with the current state of one queue item.

    The item sits under its own key, not at the top level: entity views match events
    on a top-level ``id`` and must not mistake a queue item for their entity.
    """
    data = {field: getattr(item, field, None) for field in QUEUE_ITEM_FIELDS} | overrides
    return {"_entity_name": "task", "_metadata": {"event": QUEUE_ITEM_EVENT}, QUEUE_ITEM_EVENT: data}


async def notify_queue_changed(session: AsyncSession, events: Iterable[dict[str, Any]]) -> None:
    """Publish queue item events on the event stream. Delivered when the transaction commits."""
    await pubsub.notify_in(session, [(pubsub.EVENTS_TOPIC, event) for event in events])


async def publish_tasks_changed(session: AsyncSession, items: list[TaskQueueItem]) -> None:
    """Wake up workers and refresh the UI after queued tasks were changed in place, e.g. routed again.

    Runs in the caller's transaction; the notifications are delivered when it commits.
    """
    if not items:
        return
    _ = await session.execute(NOTIFY_STATEMENT)
    await notify_queue_changed(session, [queue_item_event(item) for item in items])


def task_target(payload: dict[str, Any]) -> str:
    """The part of an entity the task works on.

    Workflow tasks for a specific step, or reporting that a specific resource finished,
    are distinct work: steps run in parallel and each completion must be processed.
    """
    if step_id := payload.get("step_id"):
        return f"step:{step_id}"
    if resource_id := payload.get("resource_id"):
        return f"resource:{resource_id}"
    return ""


def task_target_sql() -> ColumnElement[str]:
    """``task_target`` computed on the queued rows."""
    step_id = func.nullif(TaskQueueItem.payload["step_id"].as_string(), "")
    resource_id = func.nullif(TaskQueueItem.payload["resource_id"].as_string(), "")
    # concatenating NULL gives NULL, so coalesce picks the first key present
    return func.coalesce(literal("step:") + step_id, literal("resource:") + resource_id, literal(""))


def supersede_key(item: dict[str, Any]) -> tuple[str, uuid.UUID, str] | None:
    """Tasks with the same key replace each other while still queued.

    Tasks without an entity (scheduler jobs) are never superseded.
    """
    entity_id = item.get("entity_id")
    if entity_id is None:
        return None
    return item["entity"], entity_id, task_target(item.get("payload") or {})


def collapse_batch(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only the last task per supersede key within one batch, preserving order."""
    last_index = {key: i for i, item in enumerate(items) if (key := supersede_key(item)) is not None}
    return [item for i, item in enumerate(items) if (key := supersede_key(item)) is None or last_index[key] == i]


async def cancel_queued(session: AsyncSession, item: dict[str, Any]) -> list[SupersededTask]:
    """Cancel tasks with the same key that no worker has claimed yet."""
    key = supersede_key(item)
    if key is None:
        return []
    entity, entity_id, target = key
    statement = (
        update(TaskQueueItem)
        .where(
            TaskQueueItem.status == TaskQueueStatus.QUEUED,
            TaskQueueItem.entity == entity,
            TaskQueueItem.entity_id == entity_id,
            task_target_sql() == target,
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
        await resolve_targets(session, items)
        rows = [to_row(item) for item in items]
        session.add_all(rows)
        await session.flush()
        # Reload the rows for their database defaults (created_at, available_at)
        inserted = (
            await session.execute(
                select(TaskQueueItem)
                .where(TaskQueueItem.id.in_([row.id for row in rows]))
                .order_by(TaskQueueItem.seq)
                .execution_options(populate_existing=True)
            )
        ).scalars()
        _ = await session.execute(NOTIFY_STATEMENT)
        await notify_queue_changed(
            session,
            [queue_item_event(task, status=TaskQueueStatus.CANCELLED) for task in superseded]
            + [queue_item_event(row) for row in inserted],
        )
        await session.commit()

    for task in superseded:
        logger.info(f"Task {task.id} ({task.entity} {task.entity_id} {task.action}) superseded by a newer request")
        try:
            await notify_superseded(task)
        except Exception as e:
            logger.error(f"Failed to notify about superseded task {task.id}: {e}")
