"""Spawns on-demand task workers from enabled worker templates and removes the ones that exited.

Only the ``WorkerProvider`` interface is used here, so every provider gets the same scaling logic.
Workers spawned on demand exit by themselves after ``idle_timeout_seconds`` without work
(``WORKER_IDLE_EXIT_SECONDS``); the autoscaler then deletes the finished instance and its worker row.
Failed instances are kept for ``WORKER_FAILED_RETENTION_SECONDS`` so their logs can be read, and a
template whose workers keep failing is backed off so it does not spawn a new broken worker every pass.
"""

import asyncio
import logging
from collections.abc import Awaitable, Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import func, select, update
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
from .model import WorkerTemplate, WorkerTemplateDTO
from .providers import WorkerInstance, WorkerProvider, get_worker_provider
from .providers.base import ACTIVE_PHASES

logger = logging.getLogger(__name__)

# Only one scheduler process reconciles workers at a time
AUTOSCALER_LOCK_KEY = 0x494B5753  # "IKWS"

LIST_ERROR_PREFIX = "Cannot list workers"
BACKOFF_BASE_SECONDS = 30
BACKOFF_MAX_SECONDS = 600
LISTENER_PING_SECONDS = 30

ProviderFactory = Callable[[WorkerTemplateDTO], WorkerProvider]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


@dataclass
class SpawnBackoff:
    """Per-template pause after spawn errors or failed workers: 30s, doubling up to 10 minutes.

    Kept in the memory of the scheduler process; a restart starts over, which only costs one retry.
    """

    failures: dict[UUID, int] = field(default_factory=dict)
    until: dict[UUID, datetime] = field(default_factory=dict)
    # Failed instances already counted, so a retained failed instance is only counted once
    seen_failed: set[str] = field(default_factory=set)
    # What each template looked like when its failures were recorded; a change (fixed config, re-enabled) resets them
    fingerprints: dict[UUID, str] = field(default_factory=dict)

    def sync(self, template: WorkerTemplateDTO) -> None:
        fingerprint = f"{template.status}:{template.configuration.model_dump_json()}"
        if self.fingerprints.get(template.id, fingerprint) != fingerprint:
            self.reset(template.id)
        self.fingerprints[template.id] = fingerprint

    def blocked_until(self, template_id: UUID, now: datetime) -> datetime | None:
        until = self.until.get(template_id)
        return until if until is not None and until > now else None

    def failure(self, template_id: UUID, now: datetime) -> None:
        failures = self.failures.get(template_id, 0) + 1
        self.failures[template_id] = failures
        delay = min(BACKOFF_BASE_SECONDS * 2 ** (failures - 1), BACKOFF_MAX_SECONDS)
        self.until[template_id] = now + timedelta(seconds=delay)

    def reset(self, template_id: UUID) -> None:
        _ = self.failures.pop(template_id, None)
        _ = self.until.pop(template_id, None)


# Survives between passes of the scheduler job
_backoff = SpawnBackoff()


@dataclass
class ReconcileResult:
    spawned: dict[UUID, int] = field(default_factory=dict)
    removed: dict[UUID, list[str]] = field(default_factory=dict)
    # New error per template; None clears a previous error
    errors: dict[UUID, str | None] = field(default_factory=dict)


def worker_env(template: WorkerTemplateDTO) -> dict[str, str]:
    """Environment every on-demand worker gets, whatever the provider."""
    return {
        "WORKER_IDLE_EXIT_SECONDS": str(template.idle_timeout_seconds),
        "WORKER_TEMPLATE_ID": str(template.id),
        # Shown on the Workers page, so it is clear which template a worker came from
        "WORKER_NAME": template.name,
    }


def is_stuck(
    instance: WorkerInstance, now: datetime, start_timeout: timedelta, registered_hosts: set[str] | None = None
) -> bool:
    """An instance that never got its worker running (e.g. an unschedulable pod) or never registered."""
    if instance.created_at is None or now - _aware(instance.created_at) <= start_timeout:
        return False
    if instance.phase in ("pending", "unknown"):
        return True
    return instance.phase == "running" and registered_hosts is not None and instance.host not in registered_hosts


def failed_retention_expired(instance: WorkerInstance, now: datetime, retention: timedelta) -> bool:
    finished_at = instance.finished_at or instance.created_at
    if finished_at is None:
        return True
    return now - _aware(finished_at) > retention


def failure_message(instance: WorkerInstance) -> str:
    return f"Worker {instance.id} failed: {instance.reason or 'unknown reason'}"


async def _spawn_batch(provider: WorkerProvider, template: WorkerTemplateDTO, count: int) -> tuple[int, str | None]:
    results = await asyncio.gather(
        *(provider.spawn(worker_env(template)) for _ in range(count)), return_exceptions=True
    )
    errors = [r for r in results if isinstance(r, BaseException)]
    for error in errors:
        logger.error(f"Cannot spawn a worker from template {template.name}: {error}")
    return count - len(errors), (f"Cannot spawn a worker: {errors[0]}" if errors else None)


async def _remove_instance(
    provider: WorkerProvider,
    template: WorkerTemplateDTO,
    instance: WorkerInstance,
    remove_worker_rows: Callable[[str], Awaitable[Any]],
    backoff: SpawnBackoff,
    result: "ReconcileResult",
) -> None:
    try:
        # Rows first: once the instance is gone nothing would retry removing them
        await remove_worker_rows(instance.host)
        await provider.delete_instance(instance)
    except Exception as e:
        logger.error(f"Cannot delete worker {instance.id} of template {template.name}: {e}")
        result.errors[template.id] = f"Cannot delete worker {instance.id}: {e}"
        return
    result.removed.setdefault(template.id, []).append(instance.id)
    backoff.seen_failed.discard(instance.id)


async def reconcile(
    templates: list[WorkerTemplateDTO],
    claimable_tasks: int,
    free_workers: int,
    registered_hosts: set[str],
    remove_worker_rows: Callable[[str], Awaitable[Any]],
    start_timeout: timedelta,
    failed_retention: timedelta = timedelta(hours=1),
    provider_factory: ProviderFactory = get_worker_provider,
    backoff: SpawnBackoff | None = None,
    now: datetime | None = None,
) -> ReconcileResult:
    """One autoscaling pass over all templates (enabled first by priority; disabled ones are only cleaned up)."""
    now = now or datetime.now(UTC)
    backoff = backoff if backoff is not None else SpawnBackoff()
    result = ReconcileResult()
    active_count: dict[UUID, int] = {}
    providers: dict[UUID, WorkerProvider] = {}
    starting = 0
    current_failed: set[str] = set()
    listed: set[UUID] = set()

    for template in templates:
        try:
            provider = provider_factory(template)
            instances = await provider.list_instances()
        except Exception as e:
            logger.error(f"Cannot list workers of template {template.name}: {e}")
            result.errors[template.id] = f"{LIST_ERROR_PREFIX}: {e}"
            continue
        providers[template.id] = provider
        listed.add(template.id)
        backoff.sync(template)
        if template.last_error and template.last_error.startswith(LIST_ERROR_PREFIX):
            result.errors[template.id] = None

        active = 0
        healthy = False
        failed_now = False

        for instance in instances:
            if instance.phase == "succeeded":
                await _remove_instance(provider, template, instance, remove_worker_rows, backoff, result)
            elif instance.phase == "failed":
                current_failed.add(instance.id)
                if instance.id not in backoff.seen_failed:
                    backoff.seen_failed.add(instance.id)
                    backoff.failure(template.id, now)
                    failed_now = True
                    result.errors[template.id] = failure_message(instance)
                    logger.warning(f"{failure_message(instance)} (template {template.name})")
                if failed_retention_expired(instance, now, failed_retention):
                    await _remove_instance(provider, template, instance, remove_worker_rows, backoff, result)
            elif is_stuck(instance, now, start_timeout, registered_hosts):
                reason = instance.reason or f"not started within {int(start_timeout.total_seconds())}s"
                result.errors[template.id] = f"Worker {instance.id} failed: {reason}"
                failed_now = True
                # Counted once even if deleting it fails and it is seen again
                if instance.id not in backoff.seen_failed:
                    backoff.failure(template.id, now)
                    backoff.seen_failed.add(instance.id)
                current_failed.add(instance.id)
                await _remove_instance(provider, template, instance, remove_worker_rows, backoff, result)
            elif instance.phase in ACTIVE_PHASES:
                active += 1
                if instance.host in registered_hosts:
                    healthy = True
                else:
                    # Spawned but not registered yet: will pick up a task soon
                    starting += 1

        if healthy and not failed_now:
            # A worker of this template made it to the queue: the template works
            backoff.reset(template.id)
            _ = result.errors.setdefault(template.id, None)
        active_count[template.id] = active

    # Forget failed instances that are gone, so the set does not grow forever
    # (instances of templates that could not be listed are kept: they may still be there)
    unlisted = {t.id for t in templates} - listed
    if not unlisted:
        backoff.seen_failed &= current_failed

    deficit = claimable_tasks - free_workers - starting
    if deficit <= 0:
        return result

    for template in templates:
        if deficit <= 0:
            break
        provider = providers.get(template.id)
        if provider is None or template.status != ModelStatus.ENABLED:
            continue
        if (until := backoff.blocked_until(template.id, now)) is not None:
            logger.info(f"Not spawning from template {template.name} until {until.isoformat()} after failures")
            continue
        to_spawn = min(deficit, template.max_workers - active_count.get(template.id, 0))
        if to_spawn <= 0:
            continue
        spawned, error = await _spawn_batch(provider, template, to_spawn)
        if error is not None:
            result.errors[template.id] = error
            backoff.failure(template.id, now)
        if spawned:
            result.spawned[template.id] = spawned
            logger.info(f"Spawned {spawned} worker(s) from template {template.name}")
        deficit -= spawned

    return result


async def registered_worker_hosts(session: AsyncSession) -> set[str]:
    alive_since = datetime.now(UTC) - timedelta(seconds=worker_alive_seconds())
    statement = select(Worker.host).where(Worker.updated_at >= alive_since, Worker.status != "offline")
    return set((await session.execute(statement)).scalars().all())


async def save_errors(
    session: AsyncSession, templates: list[WorkerTemplateDTO], errors: dict[UUID, str | None]
) -> None:
    """Store changed errors with plain UPDATEs: a template deleted meanwhile is simply skipped."""
    current = {t.id: t.last_error for t in templates}
    for template_id, error in errors.items():
        if template_id in current and current[template_id] != error:
            _ = await session.execute(
                update(WorkerTemplate).where(WorkerTemplate.id == template_id).values(last_error=error)
            )


async def reconcile_workers() -> ReconcileResult | None:
    """Scheduler job: one autoscaling pass, skipped while another process holds the lock."""
    settings = Settings()

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
                failed_retention=timedelta(seconds=settings.WORKER_FAILED_RETENTION_SECONDS),
                backoff=_backoff,
            )

        await save_errors(session, templates, result.errors)
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
                    while True:
                        await asyncio.sleep(LISTENER_PING_SECONDS)
                        # Raises when the connection died, so the listener is re-created
                        _ = await driver.fetchval("SELECT 1")
                finally:
                    await driver.remove_listener(TASK_QUEUE_CHANNEL, on_notify)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"Worker autoscaler listener stopped: {e}, retrying in 30s")
            await asyncio.sleep(30)
