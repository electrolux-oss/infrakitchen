import asyncio
import logging
import socket
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from datetime import datetime, UTC
from typing import Any, Literal
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import IntegrityError

from application.executors.task import ExecutorTask
from application.resources.task import ResourceTask
from application.source_code_versions.task import SourceCodeVersionTask
from application.source_codes.task import SourceCodeTask
from application.storages.task import StorageTask
from application.workers.utils import (
    get_workflow_task,
    get_executor_task,
    get_source_code_task,
    get_source_code_version_task,
    get_storage_task,
    get_resource_task,
    get_workspace_task,
)
from application.workflows.task import WorkflowTask
from application.workspaces.task import WorkspaceTask
from core.tools.task import ToolTask, get_tool_task
from core.config import Settings
from core.constants.model import EventType, ModelActions
from core.db_engine import engine
from core.dependencies import get_async_session
from core.notifications.controller import NotificationEvent, publish_notification_event
from core.errors import (
    CannotProceed,
    ChildrenIsNotReady,
    CloudExecutionError,
    CloudWrongCredentials,
    EntityWrongState,
    ExitWithoutSave,
    ParentIsNotReady,
    TaskFailure,
)
from core.scheduler.executor import SchedulerExecutor
from core.task_queue.crud import TaskQueueCRUD
from core.task_queue.model import TASK_QUEUE_CHANNEL, TaskQueueItemDTO, TaskQueueKind
from core.task_queue.service import TaskQueueService
from core.telemetry import get_meter
from core.users.dependencies import get_user_service
from core.users.model import UserDTO
from core.workers.crud import WorkerCRUD
from core.workers.functions import get_host_metadata
from core.workers.model import WorkerDTO
from core.workers.service import WorkerService

logger = logging.getLogger("TaskWorker")


meter = get_meter("infrakitchen.worker.tasks")
task_executions_counter = meter.create_counter(
    name="infrakitchen.tasks.executions",
    description="Total executed tasks",
    unit="{task}",
)

TaskController = (
    SourceCodeTask
    | SourceCodeVersionTask
    | StorageTask
    | ResourceTask
    | WorkspaceTask
    | ExecutorTask
    | WorkflowTask
    | ToolTask
)

SessionFactory = Callable[[], AbstractAsyncContextManager[AsyncSession]]


class RequeueTask(Exception):
    """Raised by exception handlers to put the task back in the queue after ``delay`` seconds."""

    def __init__(self, delay: float):
        super().__init__(f"Requeue in {delay}s")
        self.delay: float = delay


class TaskWorker:
    """Pulls tasks from the DB task queue and runs them one at a time.

    The worker only connects outwards (to Postgres), so any number of workers can be
    started on any node: each one registers itself, claims tasks with a lease and keeps
    the lease alive with heartbeats while a task runs.
    """

    def __init__(
        self,
        name: str,
        session_factory: SessionFactory = get_async_session,
        settings: Settings | None = None,
    ) -> None:
        self.name: str = name
        self.session_factory: SessionFactory = session_factory
        self.settings: Settings = settings or Settings()
        self.worker: WorkerDTO = WorkerDTO(name=name, host=socket.gethostname())
        self.current_task: TaskQueueItemDTO | None = None
        # The running task's execution, so a lost lease can abort it
        self._execution: asyncio.Task[None] | None = None
        self._lease_lost: bool = False
        self._wakeup: asyncio.Event = asyncio.Event()
        self._stopping: asyncio.Event = asyncio.Event()

    @property
    def worker_id(self) -> UUID:
        if self.worker.id is None:
            raise ValueError("Worker ID is not set. Make sure to register the worker before processing tasks.")
        return self.worker.id

    @asynccontextmanager
    async def queue(self) -> AsyncIterator[TaskQueueService]:
        async with self.session_factory() as session:
            yield TaskQueueService(crud=TaskQueueCRUD(session=session))

    @asynccontextmanager
    async def workers(self) -> AsyncIterator[WorkerService]:
        async with self.session_factory() as session:
            yield WorkerService(crud=WorkerCRUD(session=session))

    # Lifecycle

    async def register(self) -> None:
        self.worker.host_metadata = await get_host_metadata()
        async with self.workers() as worker_service:
            self.worker = await worker_service.save_worker(self.worker)

    async def run(self) -> None:
        await self.register()
        logger.info(f"Worker {self.name} ({self.worker_id}) started")
        background = [
            asyncio.create_task(self.heartbeat_loop()),
            asyncio.create_task(self.listen_loop()),
        ]
        try:
            while not self._stopping.is_set():
                try:
                    did_work = await self.run_once()
                except asyncio.CancelledError:
                    raise
                except Exception as e:
                    logger.error(f"Worker loop error: {e}", exc_info=True)
                    did_work = False
                if not did_work:
                    await self.wait_for_work()
        finally:
            for task in background:
                _ = task.cancel()
            await self.set_status("offline")
            logger.info(f"Worker {self.name} stopped")

    def stop(self) -> None:
        """Stop claiming new tasks; the current task is finished first."""
        logger.info(f"Worker {self.name} is draining")
        self._stopping.set()
        self._wakeup.set()

    async def wait_for_work(self) -> None:
        try:
            _ = await asyncio.wait_for(self._wakeup.wait(), timeout=self.settings.WORKER_POLL_INTERVAL)
        except TimeoutError:
            pass
        self._wakeup.clear()

    async def heartbeat_loop(self) -> None:
        while True:
            await asyncio.sleep(self.settings.WORKER_HEARTBEAT_SECONDS)
            try:
                await self.heartbeat()
            except Exception as e:
                logger.error(f"Heartbeat failed: {e}")

    async def heartbeat(self) -> None:
        async with self.workers() as worker_service:
            self.worker = await worker_service.save_worker(self.worker)
        task = self.current_task
        if task is not None:
            async with self.queue() as queue:
                extended = await queue.heartbeat(task.id, self.worker_id, self.settings.WORKER_LEASE_SECONDS)
            if not extended:
                self.abort_current_task(task)

    def abort_current_task(self, task: TaskQueueItemDTO) -> None:
        """Stop a task this worker no longer owns.

        The lease expired (e.g. the worker lost the DB for longer than the lease) and another
        worker reaped the task, failing it and its entity. Carrying on would run e.g. a tofu
        apply in parallel with a retry the user starts after seeing the failure.
        """
        execution = self._execution
        if execution is None or execution.done() or self.current_task is not task:
            return
        logger.error(f"Lost the lease on task {task.id} ({task.entity} {task.entity_id}); aborting it")
        self._lease_lost = True
        _ = execution.cancel()

    async def listen_loop(self) -> None:
        """Wake up immediately on NOTIFY instead of waiting for the next poll."""

        def on_notify(*_: Any) -> None:
            self._wakeup.set()

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
                logger.warning(f"Task queue listener stopped: {e}, falling back to polling for 30s")
                await asyncio.sleep(30)

    async def set_status(
        self, status: Literal["free", "busy", "offline"], task_info: dict[str, str] | None = None
    ) -> None:
        if self.worker.id is None:
            return
        try:
            async with self.workers() as worker_service:
                await worker_service.change_worker_status(self.worker.id, status)
                if status == "busy":
                    await worker_service.set_current_task(self.worker.id, task_info)
                else:
                    await worker_service.set_current_task(self.worker.id, None)
            self.worker.status = status
        except Exception as e:
            logger.error(f"Failed to set worker status {status}: {e}")

    # Task processing

    async def run_once(self) -> bool:
        """Reap one dead worker's task or claim and run one queued task. Returns True if work was done."""
        async with self.queue() as queue:
            expired = await queue.claim_expired(self.worker_id, self.settings.WORKER_LEASE_SECONDS)
        if expired is not None:
            await self.reap(expired)
            return True

        if self._stopping.is_set():
            return False

        async with self.queue() as queue:
            item = await queue.claim(self.worker_id, self.settings.WORKER_LEASE_SECONDS)
        if item is None:
            return False

        await self.process_task(item)
        return True

    async def process_task(self, item: TaskQueueItemDTO) -> None:
        self.current_task = item
        task_info = {
            "task_id": str(item.id),
            "entity": item.entity,
            "entity_id": str(item.entity_id),
            "action": item.action or "",
            "started_at": datetime.now(UTC).isoformat(),
        }
        await self.set_status("busy", task_info)
        self._lease_lost = False
        self._execution = asyncio.create_task(self._execute_in_session(item))
        try:
            await self._execution
        except asyncio.CancelledError:
            if not self._lease_lost:
                raise
            # The reaper already failed the task and its entity; nothing left to record
            logger.warning(f"Task {item.id} aborted after losing its lease")
        except RequeueTask as e:
            async with self.queue() as queue:
                _ = await queue.requeue(item.id, self.worker_id, e.delay)
        except TaskFailure as e:
            async with self.queue() as queue:
                _ = await queue.fail(item.id, self.worker_id, str(e))
        except Exception as e:
            logger.error(f"Task {item.id} failed: {e}", exc_info=True)
            async with self.queue() as queue:
                _ = await queue.fail(item.id, self.worker_id, f"{type(e).__name__}: {e}")
        else:
            async with self.queue() as queue:
                _ = await queue.complete(item.id, self.worker_id)
        finally:
            self._execution = None
            self.current_task = None
            await self.set_status("free")
            async with self.workers() as worker_service:
                await worker_service.increment_tasks_completed(self.worker.id)

    async def _execute_in_session(self, item: TaskQueueItemDTO) -> None:
        async with self.session_factory() as session:
            try:
                await self.execute_task(session, item)
            except BaseException:
                # Includes cancellation after a lost lease
                await session.rollback()
                raise

    async def execute_task(self, session: AsyncSession, item: TaskQueueItemDTO) -> None:
        if item.kind == TaskQueueKind.SCHEDULER_JOB:
            await self.process_scheduler_job(session, item)
            return

        task_controller = await self.build_task_controller(session, item)
        action = item.action

        try:
            await task_controller.start_pipeline()
            await self._send_success_notification(task_controller, action)
            task_executions_counter.add(1, {"job_type": item.entity, "status": "success"})
        except Exception as e:
            task_executions_counter.add(1, {"job_type": item.entity, "status": "error"})
            await self.handle_exception(e, item, task_controller, action)

    async def build_task_controller(self, session: AsyncSession, item: TaskQueueItemDTO) -> TaskController:
        action = item.action
        if not action:
            raise CannotProceed("Action is not defined in task")

        if not item.entity_id:
            raise CannotProceed("Entity id is not defined in task")

        user_id = item.payload.get("user")
        if not user_id:
            raise CannotProceed("User is not defined in task")

        if not item.entity:
            raise CannotProceed("Entity controller is not defined in task")

        user = await get_user_service(session=session).get_dto_by_id(user_id)
        if not user:
            raise CannotProceed(f"User {user_id} not found")

        return await self.get_task_controller(
            session=session,
            entity_controller=item.entity,
            obj_id=item.entity_id,
            user=user,
            action=ModelActions(action),
            trace_id=item.payload.get("trace_id"),
            audit_log_id=item.payload.get("audit_log_id"),
            step_id=item.payload.get("step_id"),
            resource_id=item.payload.get("resource_id"),
        )

    async def process_scheduler_job(self, session: AsyncSession, item: TaskQueueItemDTO) -> None:
        job_id = item.payload.get("job_id")
        if not job_id:
            raise CannotProceed("Scheduler job_id is not defined in task")

        job_type = item.payload.get("job_type")
        if not job_type:
            raise CannotProceed("Scheduler job_type is not defined in task")

        job_script = item.payload.get("job_script")
        if not job_script:
            raise CannotProceed("Scheduler job_script is not defined in task")

        job_executor = SchedulerExecutor(session)

        await job_executor.execute(job_type=job_type, script=job_script)
        await session.commit()

    async def reap(self, item: TaskQueueItemDTO) -> None:
        """Fail a task whose worker died. IaC runs are never re-run automatically."""
        error = "Worker lost (lease expired)"
        logger.warning(f"Reaping task {item.id} ({item.entity} {item.entity_id}): {error}")
        if item.kind == TaskQueueKind.ENTITY_TASK:
            try:
                async with self.session_factory() as session:
                    task_controller = await self.build_task_controller(session, item)
                    task_controller.logger.error(error)
                    await task_controller.make_failed()
                    await task_controller.logger.save_log()
                    await session.commit()
                    entity_name = task_controller.logger.entity_name or item.entity
                    entity_label = entity_name.replace("_", " ").capitalize()
                    await self.send_task_notification(
                        task_controller,
                        f"Task {item.action or ''} failed for {task_controller.logger.entity_id}: {error}",
                        title=f"{entity_label} {item.action or 'task'} failed",
                        status="error",
                    )
            except Exception as e:
                logger.error(f"Failed to mark entity of reaped task {item.id} as failed: {e}")

        async with self.queue() as queue:
            # claim_expired leased the task to this worker, so it may now fail it
            _ = await queue.fail(item.id, self.worker_id, error)

    async def get_task_controller(
        self,
        session: AsyncSession,
        entity_controller: str,
        obj_id: UUID,
        user: UserDTO,
        action: ModelActions,
        trace_id: str | None = None,
        audit_log_id: UUID | None = None,
        step_id: str | None = None,
        resource_id: str | None = None,
    ) -> TaskController:
        match entity_controller:
            case "source_code":
                return await get_source_code_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case "source_code_version":
                return await get_source_code_version_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case "storage":
                return await get_storage_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case "resource":
                return await get_resource_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case "workspace":
                return await get_workspace_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case "executor":
                return await get_executor_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case "workflow":
                return await get_workflow_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    step_id=step_id,
                    resource_id=resource_id,
                )
            case "tool":
                return await get_tool_task(
                    session=session,
                    obj_id=obj_id,
                    user=user,
                    action=action,
                    trace_id=trace_id,
                    audit_log_id=audit_log_id,
                )
            case _:
                raise CannotProceed(f"Unknown entity controller: {entity_controller}")

    # Exception handling

    @staticmethod
    def retry_delay(item: TaskQueueItemDTO) -> float:
        """Back off 5s, 10s, 20s, ... between not-ready retries."""
        return 5.0 * (2**item.retries)

    async def _fail_timed_out(self, e, task_controller, action=None):
        task_controller.logger.error("Task is timed out")
        await task_controller.make_failed()
        await task_controller.logger.save_log()
        entity_name = task_controller.logger.entity_name
        entity_label = entity_name.replace("_", " ").capitalize()
        await self.send_task_notification(
            task_controller,
            f"Task {action or ''} failed for {task_controller.logger.entity_id}: Task is timed out".strip(),
            title=f"{entity_label} {action or 'task'} timed out".strip(),
            status="error",
        )
        raise TaskFailure("Task is timed out") from e

    async def handle_is_not_ready_exception(self, e, item: TaskQueueItemDTO, task_controller, action=None):
        task_controller.logger.warning(f"{item.retries}/{item.max_retries} {e}")
        if item.retries >= item.max_retries:
            await self._fail_timed_out(e, task_controller, action)
        make_retry = getattr(task_controller, "make_retry", None)
        if make_retry is not None:
            await make_retry(item.retries, item.max_retries)
        await task_controller.logger.save_log()
        raise RequeueTask(self.retry_delay(item)) from e

    async def handle_is_not_right_state_exception(self, e, item: TaskQueueItemDTO, task_controller, action=None):
        if item.retries >= item.max_retries:
            await self._fail_timed_out(e, task_controller, action)
        await task_controller.logger.save_log()
        raise RequeueTask(self.retry_delay(item)) from e

    async def handle_generic_exception(self, e, task_controller, error_type, action=None):
        task_controller.logger.error(f"{error_type}: {e}")
        await task_controller.make_failed()
        await task_controller.logger.save_log()
        entity_name = task_controller.logger.entity_name
        entity_label = entity_name.replace("_", " ").capitalize()
        await self.send_task_notification(
            task_controller,
            f"Task {action or ''} failed for {task_controller.logger.entity_id}: {error_type}".strip(),
            title=f"{entity_label} {action or 'task'} failed".strip(),
            status="error",
        )
        raise TaskFailure(f"{error_type}: {e}") from e

    async def handle_exit_without_state_exception(self, e, task_controller, action=None):
        error_message = f"ExitWithoutSave: {e}"
        task_controller.logger.error(error_message)
        await task_controller.logger.save_log()
        entity_name = task_controller.logger.entity_name
        entity_label = entity_name.replace("_", " ").capitalize()
        await self.send_task_notification(
            task_controller,
            f"Task {action or ''} failed for {task_controller.logger.entity_id}: {error_message}".strip(),
            title=f"{entity_label} {action or 'task'} failed".strip(),
            status="error",
        )
        raise TaskFailure(error_message) from e

    async def handle_unexpected_exception(self, e, task_controller, action=None):
        logger.error(f"Unhandled exception: {e}", exc_info=True)
        task_controller.logger.error("Unhandled exception occurred")
        await task_controller.make_failed()
        await task_controller.logger.save_log()

        error_message = f"UnhandledException: {e}"
        entity_name = task_controller.logger.entity_name
        entity_label = entity_name.replace("_", " ").capitalize()
        await self.send_task_notification(
            task_controller,
            f"Task {action or ''} failed for {task_controller.logger.entity_id}: {error_message}".strip(),
            title=f"{entity_label} {action or 'task'} failed".strip(),
            status="error",
        )
        raise TaskFailure(error_message) from e

    async def send_task_notification(
        self,
        task_controller,
        message: str,
        title: str | None = None,
        status: str = "info",
    ):
        logger.debug(f"Preparing to send notification - entity_id: {task_controller.logger.entity_id}")
        event_message = NotificationEvent(
            message=message,
            title=title or "Task Update",
            status=status,
            entity_id=task_controller.logger.entity_id,
            entity_type=task_controller.logger.entity_name,
            event_type=EventType.EXECUTE,
        )
        await publish_notification_event(event_message)

    async def _send_success_notification(self, task_controller, action):
        entity_name = task_controller.logger.entity_name
        title = f"{entity_name.replace('_', ' ').capitalize()} {action} succeeded"
        notification_message = f"Task {action} for {entity_name} completed successfully."
        await self.send_task_notification(task_controller, notification_message, title=title, status="success")

    async def handle_exception(self, e, item: TaskQueueItemDTO, task_controller, action=None):
        if isinstance(e, ParentIsNotReady) or isinstance(e, ChildrenIsNotReady):
            await self.handle_is_not_ready_exception(e, item, task_controller, action=action)
        elif isinstance(e, EntityWrongState):
            await self.handle_is_not_right_state_exception(e, item, task_controller, action=action)
        elif isinstance(e, CannotProceed):
            await self.handle_generic_exception(e, task_controller, "CannotProceed", action=action)
        elif isinstance(e, CloudWrongCredentials):
            await self.handle_generic_exception(e, task_controller, "CloudWrongCredentials", action=action)
        elif isinstance(e, CloudExecutionError):
            await self.handle_generic_exception(e, task_controller, "CloudExecutionError", action=action)
        elif isinstance(e, ExitWithoutSave):
            await self.handle_exit_without_state_exception(e, task_controller, action=action)
        elif isinstance(e, AssertionError):
            await self.handle_generic_exception(e, task_controller, "AssertionError", action=action)
        elif isinstance(e, IntegrityError):
            await self.handle_generic_exception(e, task_controller, "IntegrityError", action=action)
        elif isinstance(e, FileNotFoundError):
            await self.handle_generic_exception(e, task_controller, "FileNotFoundError", action=action)
        else:
            await self.handle_unexpected_exception(e, task_controller, action=action)
