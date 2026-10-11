"""Spawns on-demand task workers from enabled worker templates and removes the ones that exited.

Only the ``WorkerProvider`` interface is used here, so every provider gets the same scaling logic.
Workers spawned on demand exit by themselves after ``idle_timeout_seconds`` without work
(``WORKER_IDLE_EXIT_SECONDS``); the autoscaler then deletes the finished instance and its worker row.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import Settings
from core.constants.model import ModelStatus
from core.db_engine import engine
from core.dependencies import get_async_session
from core.task_queue.crud import TaskQueueCRUD
from core.task_queue.model import TASK_QUEUE_CHANNEL
from core.task_queue.service import TaskQueueService, worker_alive_seconds
from core.workers.crud import WorkerCRUD
from core.workers.model import Worker
from core.workers.service import WorkerService

from .crud import WorkerTemplateCRUD
from .model import WorkerTemplateDTO
from .providers import WorkerInstance, WorkerProvider, get_worker_provider
from .providers.base import ACTIVE_PHASES, TERMINAL_PHASES

logger = logging.getLogger(__name__)

# Only one scheduler process reconciles workers at a time
AUTOSCALER_LOCK_KEY = 0x494B5753  # "IKWS"

ProviderFactory = Callable[[WorkerTemplateDTO], WorkerProvider]


@dataclass
class ReconcileResult:
    spawned: dict[UUID, int] = field(default_factory=dict)
    removed: dict[UUID, list[str]] = field(default_factory=dict)
    # Last error per template; None clears a previous error
    errors: dict[UUID, str | None] = field(default_factory=dict)


def worker_env(template: WorkerTemplateDTO) -> dict[str, str]:
    """Environment every on-demand worker gets, whatever the provider."""
    return {
        "WORKER_IDLE_EXIT_SECONDS": str(template.idle_timeout_seconds),
        "WORKER_TEMPLATE_ID": str(template.id),
        "WORKER_NAME": "task_worker",
    }


def is_stuck(instance: WorkerInstance, now: datetime, start_timeout: timedelta) -> bool:
    """An instance that never got its worker running, e.g. an unpullable image or an unschedulable pod."""
    if instance.phase not in ("pending", "unknown") or instance.created_at is None:
        return False
    created_at = instance.created_at if instance.created_at.tzinfo else instance.created_at.replace(tzinfo=UTC)
    return now - created_at > start_timeout


async def reconcile(
    templates: list[WorkerTemplateDTO],
    claimable_tasks: int,
    free_workers: int,
    registered_hosts: set[str],
    remove_worker_rows: Callable[[str], Awaitable[Any]],
    start_timeout: timedelta,
    provider_factory: ProviderFactory = get_worker_provider,
    now: datetime | None = None,
) -> ReconcileResult:
    """One autoscaling pass over all templates (enabled first by priority; disabled ones are only cleaned up)."""
    now = now or datetime.now(UTC)
    result = ReconcileResult()
    active_count: dict[UUID, int] = {}
    providers: dict[UUID, WorkerProvider] = {}
    starting = 0

    for template in templates:
        try:
            provider = provider_factory(template)
            instances = await provider.list_instances()
        except Exception as e:
            logger.error(f"Cannot list workers of template {template.name}: {e}")
            result.errors[template.id] = f"Cannot list workers: {e}"
            continue
        providers[template.id] = provider
        result.errors[template.id] = None

        removed: list[str] = []
        active = 0
        for instance in instances:
            if instance.phase in TERMINAL_PHASES or is_stuck(instance, now, start_timeout):
                try:
                    await provider.delete_instance(instance)
                    await remove_worker_rows(instance.host)
                    removed.append(instance.id)
                except Exception as e:
                    logger.error(f"Cannot delete worker {instance.id} of template {template.name}: {e}")
                    result.errors[template.id] = f"Cannot delete worker {instance.id}: {e}"
            elif instance.phase in ACTIVE_PHASES:
                active += 1
                # Spawned but not registered yet: will pick up a task soon
                if instance.host not in registered_hosts:
                    starting += 1
        if removed:
            result.removed[template.id] = removed
        active_count[template.id] = active

    deficit = claimable_tasks - free_workers - starting
    if deficit <= 0:
        return result

    for template in templates:
        if deficit <= 0:
            break
        provider = providers.get(template.id)
        if provider is None or template.status != ModelStatus.ENABLED:
            continue
        capacity = template.max_workers - active_count.get(template.id, 0)
        to_spawn = min(deficit, capacity)
        spawned = 0
        for _ in range(max(to_spawn, 0)):
            try:
                _ = await provider.spawn(worker_env(template))
            except Exception as e:
                logger.error(f"Cannot spawn a worker from template {template.name}: {e}")
                result.errors[template.id] = f"Cannot spawn a worker: {e}"
                break
            spawned += 1
        if spawned:
            result.spawned[template.id] = spawned
            logger.info(f"Spawned {spawned} worker(s) from template {template.name}")
        deficit -= spawned

    return result


async def registered_worker_hosts(session: AsyncSession) -> set[str]:
    alive_since = datetime.now(UTC) - timedelta(seconds=worker_alive_seconds())
    statement = select(Worker.host).where(Worker.updated_at >= alive_since, Worker.status != "offline")
    return set((await session.execute(statement)).scalars().all())


async def reconcile_workers() -> ReconcileResult | None:
    """Scheduler job: one autoscaling pass, skipped while another process holds the lock."""
    settings = Settings()
    if not settings.WORKER_AUTOSCALER_ENABLED:
        return None

    async with get_async_session() as session:
        # Held until the transaction ends, so a slow pass never overlaps another scheduler's pass
        locked = (await session.execute(select(func.pg_try_advisory_xact_lock(AUTOSCALER_LOCK_KEY)))).scalar_one()
        if not locked:
            return None

        crud = WorkerTemplateCRUD(session)
        db_templates = await crud.get_all(sort=("priority", "DESC"))
        if not db_templates:
            return None
        templates = [WorkerTemplateDTO.model_validate(t) for t in db_templates]
        # Enabled templates first, by priority; get_all keeps the priority order within each group
        templates.sort(key=lambda t: t.status != ModelStatus.ENABLED)

        queue = TaskQueueService(crud=TaskQueueCRUD(session))
        stats = await queue.stats(worker_alive_seconds())
        claimable = await queue.count_claimable()
        hosts = await registered_worker_hosts(session)

        async with get_async_session() as worker_session:
            workers = WorkerService(crud=WorkerCRUD(session=worker_session))
            result = await reconcile(
                templates=templates,
                claimable_tasks=claimable,
                free_workers=stats.workers_free,
                registered_hosts=hosts,
                remove_worker_rows=workers.delete_by_host,
                start_timeout=timedelta(seconds=settings.WORKER_START_TIMEOUT_SECONDS),
            )

        by_id = {t.id: t for t in db_templates}
        for template_id, error in result.errors.items():
            template = by_id.get(template_id)
            if template is not None and template.last_error != error:
                template.last_error = error
        await session.commit()
    return result


async def listen_for_queued_tasks(on_task_queued: Callable[[], None]) -> None:
    """Call ``on_task_queued`` whenever tasks are enqueued, so bursts are scaled without waiting for the interval."""

    def on_notify(*_: Any) -> None:
        on_task_queued()

    while True:
        try:
            async with engine.connect() as conn:
                raw = await conn.get_raw_connection()
                driver = raw.driver_connection
                if driver is None:
                    raise RuntimeError("No driver connection available for LISTEN")
                await driver.add_listener(TASK_QUEUE_CHANNEL, on_notify)
                try:
                    await asyncio.Future()
                finally:
                    await driver.remove_listener(TASK_QUEUE_CHANNEL, on_notify)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Worker autoscaler listener stopped: {e}, retrying in 30s")
            await asyncio.sleep(30)
