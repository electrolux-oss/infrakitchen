"""Which worker template's workers run a task.

Resolved like the IaC tool of an entity: the worker template selected on the resource or executor,
else the global default template, else None, which means static workers run it. A selected template
that is disabled is kept: its tasks wait until it is enabled again rather than running on workers
the entity did not choose.

Registered as the task queue's pool resolver (``core/task_queue/routing.py``) by ``application/__init__.py``,
once the models of every routed entity are imported.
"""

from typing import Any
from uuid import UUID

from sqlalchemy import ColumnElement, Select, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.executors.model import Executor
from application.resources.model import Resource
from core.task_queue.model import TaskQueueItem
from core.task_queue.routing import register_pool_resolver

from .functions import DEFAULT_LOCK_KEY
from .model import WorkerTemplate

# Entities that select their own worker template; every other task uses the default one
ROUTED_ENTITIES: dict[str, type[Resource] | type[Executor]] = {"resource": Resource, "executor": Executor}


def default_template_id_sql() -> Select[Any]:
    """The default template; it is always enabled, as the default cannot be disabled."""
    return select(WorkerTemplate.id).where(WorkerTemplate.is_default.is_(True)).limit(1)


def selected_template_id_sql(entity: str, entity_id: Any) -> Select[Any] | None:
    """The template selected on the entity; None for entities that cannot select one."""
    model = ROUTED_ENTITIES.get(entity)
    if model is None:
        return None
    return select(model.worker_template_id).where(model.id == entity_id).limit(1)


def target_template_sql(entity: str, entity_id: Any) -> ColumnElement[Any]:
    default = default_template_id_sql().scalar_subquery()
    selected = selected_template_id_sql(entity, entity_id) if entity_id is not None else None
    if selected is None:
        return default
    return func.coalesce(selected.scalar_subquery(), default)


def correlated_target_sql() -> ColumnElement[Any]:
    """``target_template_sql`` for the queue rows themselves, in an UPDATE."""
    candidates: list[ColumnElement[Any]] = []
    for entity in ROUTED_ENTITIES:
        selected = selected_template_id_sql(entity, TaskQueueItem.entity_id)
        if selected is not None:
            candidates.append(selected.where(TaskQueueItem.entity == literal(entity)).scalar_subquery())
    return func.coalesce(*candidates, default_template_id_sql().scalar_subquery())


async def resolve_worker_templates(session: AsyncSession, items: list[dict[str, Any]]) -> list[UUID | None]:
    """Pool resolver of the task queue: the template of each item about to be queued, in one round trip."""
    # Shared with other enqueues, exclusive while the default changes: a task is never routed to a stale default
    _ = await session.execute(select(func.pg_advisory_xact_lock_shared(DEFAULT_LOCK_KEY)))
    columns = [
        target_template_sql(item["entity"], item.get("entity_id")).label(f"t{i}") for i, item in enumerate(items)
    ]
    return list((await session.execute(select(*columns))).one())


def register_task_router() -> None:
    register_pool_resolver(resolve_worker_templates)
