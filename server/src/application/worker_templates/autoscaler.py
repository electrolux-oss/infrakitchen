"""Spawns on-demand task workers from enabled worker templates and removes the ones that exited.

Tasks are routed to one worker template when they are queued (``core/task_queue/routing.py``), so
each template is scaled for its own tasks only; a template that cannot spawn leaves its tasks waiting.
Only the ``WorkerProviderAdapter`` interface is used here, so every provider gets the same scaling logic.
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

from core.adapters.provider_adapters import ACTIVE_PHASES, WorkerInstance, WorkerProviderAdapter
from core.config import Settings
from core.constants.model import ModelStatus
from core.dependencies import get_async_session
from core.task_queue.dependencies import get_task_queue_service
from core.task_queue.listener import listen_task_queue
from core.task_queue.service import worker_alive_seconds
from core.workers.dependencies import get_worker_service

from .dependencies import get_worker_template_service
from .functions import autoscaler_lock
from .model import WorkerTemplateDTO
from application.tools.worker_manager import get_worker_provider
from .service import WorkerTemplateService
from application.providers.worker_providers.base import WORKER_NAME_PREFIX

logger = logging.getLogger(__name__)

LIST_ERROR_PREFIX = "Cannot list workers"
BACKOFF_BASE_SECONDS = 30
BACKOFF_MAX_SECONDS = 600

ProviderFactory = Callable[[WorkerTemplateDTO], WorkerProviderAdapter]


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)


@dataclass
class SpawnBackoff:
    """Per-template pause after spawn errors or failed workers: 30s, doubling up to 10 minutes.

    Loaded from and saved to the worker templates (``spawn_*`` columns), so it is shared by every scheduler
    process and survives restarts. Reset when the template is enabled again or its configuration changes.
    """

    failures: dict[UUID, int] = field(default_factory=dict)
    until: dict[UUID, datetime] = field(default_factory=dict)
    # When the last failure was counted: failed instances that ended before it are not counted again
    failed_at: dict[UUID, datetime] = field(default_factory=dict)
    # Templates whose state changed and has to be saved
    touched: set[UUID] = field(default_factory=set)

    @classmethod
    def load(cls, templates: list[WorkerTemplateDTO]) -> "SpawnBackoff":
        backoff = cls()
        for template in templates:
            if template.spawn_failures:
                backoff.failures[template.id] = template.spawn_failures
            if template.spawn_blocked_until:
                backoff.until[template.id] = _aware(template.spawn_blocked_until)
            if template.spawn_failed_at:
                backoff.failed_at[template.id] = _aware(template.spawn_failed_at)
        return backoff

    def blocked_until(self, template_id: UUID, now: datetime) -> datetime | None:
        until = self.until.get(template_id)
        return until if until is not None and until > now else None

    def is_new_failure(self, template_id: UUID, instance_time: datetime | None) -> bool:
        counted_at = self.failed_at.get(template_id)
        if counted_at is None:
            return True
        return instance_time is not None and _aware(instance_time) > counted_at

    def failure(self, template_id: UUID, now: datetime) -> None:
        failures = self.failures.get(template_id, 0) + 1
        self.failures[template_id] = failures
        delay = min(BACKOFF_BASE_SECONDS * 2 ** (failures - 1), BACKOFF_MAX_SECONDS)
        self.until[template_id] = now + timedelta(seconds=delay)
        self.failed_at[template_id] = now
        self.touched.add(template_id)

    def reset(self, template_id: UUID) -> None:
        """Forget the failures but not what was already counted, so a retained failed instance is not counted again."""
        if self.failures.pop(template_id, None) is not None:
            self.touched.add(template_id)
        _ = self.until.pop(template_id, None)


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
    instance: WorkerInstance, now: datetime, start_timeout: timedelta, known_hosts: set[str] | None = None
) -> bool:
    """An instance that never got its worker running (e.g. an unschedulable pod) or whose worker never registered.

    ``known_hosts`` are the hosts that ever registered a worker, alive or not: a worker that missed some
    heartbeats in the middle of a long task, or that is going offline before it exits, is not stuck.
    """
    if instance.created_at is None or now - _aware(instance.created_at) <= start_timeout:
        return False
    if instance.phase in ("pending", "unknown"):
        return True
    return instance.phase == "running" and known_hosts is not None and instance.host not in known_hosts


def failed_retention_expired(instance: WorkerInstance, now: datetime, retention: timedelta) -> bool:
    finished_at = instance.finished_at or instance.created_at
    if finished_at is None:
        return True
    return now - _aware(finished_at) > retention


def failure_message(instance: WorkerInstance) -> str:
    return f"Worker {instance.id} failed: {instance.reason or 'unknown reason'}"


async def _spawn_batch(
    provider: WorkerProviderAdapter, template: WorkerTemplateDTO, count: int
) -> tuple[int, str | None]:
    results = await asyncio.gather(
        *(provider.spawn(worker_env(template)) for _ in range(count)), return_exceptions=True
    )
    errors = [r for r in results if isinstance(r, BaseException)]
    for error in errors:
        logger.error(f"Cannot spawn a worker from template {template.name}: {error}")
    return count - len(errors), (f"Cannot spawn a worker: {errors[0]}" if errors else None)


async def _remove_instance(
    provider: WorkerProviderAdapter,
    template: WorkerTemplateDTO,
    instance: WorkerInstance,
    remove_worker_rows: Callable[[str], Awaitable[Any]],
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


async def reconcile(
    templates: list[WorkerTemplateDTO],
    claimable_by_template: dict[UUID | None, int],
    free_by_template: dict[UUID | None, int],
    registered_hosts: set[str],
    remove_worker_rows: Callable[[str], Awaitable[Any]],
    start_timeout: timedelta,
    known_hosts: set[str] | None = None,
    remove_gone_worker_rows: Callable[[WorkerTemplateDTO, set[str]], Awaitable[Any]] | None = None,
    failed_retention: timedelta = timedelta(hours=1),
    provider_factory: ProviderFactory = get_worker_provider,
    backoff: SpawnBackoff | None = None,
    now: datetime | None = None,
) -> ReconcileResult:
    """One autoscaling pass over all templates; disabled ones are only cleaned up.

    ``registered_hosts`` have a live worker; ``known_hosts`` ever registered one (defaults to the live ones).
    ``remove_gone_worker_rows`` drops the rows of dead workers whose instance is gone, e.g. a pod deleted by hand.
    """
    now = now or datetime.now(UTC)
    known_hosts = known_hosts if known_hosts is not None else registered_hosts
    backoff = backoff if backoff is not None else SpawnBackoff()
    result = ReconcileResult()
    active_count: dict[UUID, int] = {}
    starting_count: dict[UUID, int] = {}
    providers: dict[UUID, WorkerProviderAdapter] = {}

    for template in templates:
        try:
            provider = provider_factory(template)
            instances = await provider.list_instances()
        except Exception as e:
            logger.error(f"Cannot list workers of template {template.name}: {e}")
            result.errors[template.id] = f"{LIST_ERROR_PREFIX}: {e}"
            continue
        providers[template.id] = provider
        if template.last_error and template.last_error.startswith(LIST_ERROR_PREFIX):
            result.errors[template.id] = None
        if remove_gone_worker_rows is not None:
            try:
                await remove_gone_worker_rows(template, {instance.host for instance in instances})
            except Exception as e:
                logger.error(f"Cannot remove rows of gone workers of template {template.name}: {e}")

        active = 0
        starting = 0
        healthy = False
        failed_now = False

        for instance in instances:
            if instance.phase == "succeeded":
                await _remove_instance(provider, template, instance, remove_worker_rows, result)
            elif instance.phase == "failed":
                if backoff.is_new_failure(template.id, instance.finished_at or instance.created_at):
                    backoff.failure(template.id, now)
                    failed_now = True
                    result.errors[template.id] = failure_message(instance)
                    logger.warning(f"{failure_message(instance)} (template {template.name})")
                if failed_retention_expired(instance, now, failed_retention):
                    await _remove_instance(provider, template, instance, remove_worker_rows, result)
            elif is_stuck(instance, now, start_timeout, known_hosts):
                reason = instance.reason or f"not started within {int(start_timeout.total_seconds())}s"
                result.errors[template.id] = f"Worker {instance.id} failed: {reason}"
                failed_now = True
                # Counted once even if deleting it fails and it is seen again
                if backoff.is_new_failure(template.id, instance.created_at):
                    backoff.failure(template.id, now)
                await _remove_instance(provider, template, instance, remove_worker_rows, result)
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
        starting_count[template.id] = starting

    for template in templates:
        provider = providers.get(template.id)
        if provider is None or template.status != ModelStatus.ENABLED:
            continue
        # Only this template's workers can run its tasks, and they run nothing else
        deficit = (
            claimable_by_template.get(template.id, 0)
            - free_by_template.get(template.id, 0)
            - starting_count.get(template.id, 0)
        )
        to_spawn = min(deficit, template.max_workers - active_count.get(template.id, 0))
        if to_spawn <= 0:
            continue
        if (until := backoff.blocked_until(template.id, now)) is not None:
            logger.info(f"Not spawning from template {template.name} until {until.isoformat()} after failures")
            continue
        spawned, error = await _spawn_batch(provider, template, to_spawn)
        if error is not None:
            result.errors[template.id] = error
            backoff.failure(template.id, now)
        if spawned:
            result.spawned[template.id] = spawned
            logger.info(f"Spawned {spawned} worker(s) from template {template.name}")

    return result


async def save_errors(
    service: WorkerTemplateService,
    templates: list[WorkerTemplateDTO],
    errors: dict[UUID, str | None],
    backoff: SpawnBackoff | None = None,
) -> None:
    """Store the errors and backoff states that changed."""
    current = {t.id: t.last_error for t in templates}
    for template_id, error in errors.items():
        if template_id in current and current[template_id] != error:
            await service.set_last_error(template_id, error)
    if backoff is not None:
        for template_id in backoff.touched & current.keys():
            await service.set_spawn_backoff(
                template_id,
                backoff.failures.get(template_id, 0),
                backoff.until.get(template_id),
                backoff.failed_at.get(template_id),
            )


async def reconcile_workers() -> ReconcileResult | None:
    """Scheduler job: one autoscaling pass, skipped while another process holds the lock."""
    settings = Settings()

    async with autoscaler_lock() as locked:
        if not locked:
            return None

        # Short transaction: read the state, then talk to the providers without holding it open
        async with get_async_session() as session:
            template_service = get_worker_template_service(session)
            db_templates = await template_service.query_all(sort=("name", "ASC"))
            if not db_templates:
                return None

            templates = [WorkerTemplateDTO.model_validate(t) for t in db_templates]
            queue = get_task_queue_service(session)
            claimable = await queue.count_claimable_by_template()
            workers = await queue.worker_counts_by_template(worker_alive_seconds())
            worker_service = get_worker_service(session)
            hosts = await worker_service.get_live_hosts(worker_alive_seconds())
            # Hosts of spawned workers that registered at least once; their rows are removed with the instance
            known_hosts = await worker_service.get_hosts_with_prefix(WORKER_NAME_PREFIX)
            await session.commit()

        backoff = SpawnBackoff.load(templates)
        async with get_async_session() as worker_session:
            worker_service = get_worker_service(worker_session)
            result = await reconcile(
                templates=templates,
                claimable_by_template=claimable,
                free_by_template={pool: counts["free"] for pool, counts in workers.items()},
                registered_hosts=hosts,
                known_hosts=known_hosts,
                remove_worker_rows=lambda host: worker_service.delete_by_hosts([host]),
                remove_gone_worker_rows=lambda template, hosts: worker_service.delete_gone(
                    str(template.id), hosts, worker_alive_seconds()
                ),
                start_timeout=timedelta(seconds=settings.WORKER_START_TIMEOUT_SECONDS),
                failed_retention=timedelta(seconds=settings.WORKER_FAILED_RETENTION_SECONDS),
                backoff=backoff,
            )

        async with get_async_session() as session:
            await save_errors(get_worker_template_service(session), templates, result.errors, backoff)
            await session.commit()
    return result


async def listen_for_queued_tasks(on_task_queued: Callable[[], None]) -> None:
    """Call ``on_task_queued`` whenever tasks are enqueued, so bursts are scaled without waiting for the interval."""
    await listen_task_queue(on_task_queued, name="Worker autoscaler")
