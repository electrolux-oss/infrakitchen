import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4

import pytest
from unittest.mock import Mock, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession
from application.workers import TaskWorker
from core.constants.model import EventType
from core.notifications.controller import NotificationEvent
from core.errors import CannotProceed, ExitWithoutSave, ParentIsNotReady
from core.scheduler.executor import SchedulerExecutor
from core.task_queue.model import TaskQueueItemDTO, TaskQueueKind

import application.workers.task_worker as tw_mod


@pytest.fixture
def mock_session():
    session = Mock(spec=AsyncSession)
    session.commit = AsyncMock()
    session.rollback = AsyncMock()
    return session


@pytest.fixture
def mock_queue():
    queue = Mock()
    queue.claim = AsyncMock(return_value=None)
    queue.claim_expired = AsyncMock(return_value=None)
    queue.complete = AsyncMock()
    queue.fail = AsyncMock()
    queue.requeue = AsyncMock()
    queue.heartbeat = AsyncMock(return_value=True)
    return queue


@pytest.fixture
def mock_worker_service():
    service = Mock()
    service.change_worker_status = AsyncMock()
    service.set_current_task = AsyncMock()
    service.increment_tasks_completed = AsyncMock()
    service.save_worker = AsyncMock()
    return service


@pytest.fixture
def task_worker(mock_session, mock_queue, mock_worker_service, monkeypatch):
    @asynccontextmanager
    async def session_factory():
        yield mock_session

    @asynccontextmanager
    async def queue():
        yield mock_queue

    @asynccontextmanager
    async def workers():
        yield mock_worker_service

    worker = TaskWorker(name="task_worker", session_factory=session_factory)
    worker.worker.id = uuid4()
    monkeypatch.setattr(worker, "queue", queue)
    monkeypatch.setattr(worker, "workers", workers)
    return worker


def make_item(**kwargs) -> TaskQueueItemDTO:
    defaults = {
        "id": uuid4(),
        "kind": TaskQueueKind.ENTITY_TASK,
        "entity": "source_code",
        "entity_id": uuid4(),
        "action": "sync",
        "payload": {"user": str(uuid4())},
    }
    defaults.update(kwargs)
    return TaskQueueItemDTO.model_validate(defaults)


def make_scheduler_item(**payload) -> TaskQueueItemDTO:
    return make_item(
        kind=TaskQueueKind.SCHEDULER_JOB, entity="scheduler_job", entity_id=None, action=None, payload=payload
    )


class TestSchedulerJobs:
    async def test_process_scheduler_job_success(self, task_worker, mock_session, monkeypatch):
        mock_executor = Mock(spec=SchedulerExecutor)
        mock_executor.execute = AsyncMock()
        monkeypatch.setattr(tw_mod, "SchedulerExecutor", lambda session: mock_executor)

        item = make_scheduler_item(job_id="abc123", job_type="SQL", job_script="DELETE from logs")
        await task_worker.execute_task(mock_session, item)

        mock_executor.execute.assert_awaited_once_with(job_type="SQL", script="DELETE from logs")
        mock_session.commit.assert_awaited_once()

    @pytest.mark.parametrize(
        "payload,error",
        [
            ({"job_type": "SQL", "job_script": "x"}, "Scheduler job_id is not defined in task"),
            ({"job_id": "abc", "job_script": "x"}, "Scheduler job_type is not defined in task"),
            ({"job_id": "abc", "job_type": "SQL"}, "Scheduler job_script is not defined in task"),
        ],
    )
    async def test_process_scheduler_job_missing_fields(self, task_worker, mock_session, payload, error):
        with pytest.raises(CannotProceed) as e:
            await task_worker.execute_task(mock_session, make_scheduler_item(**payload))

        assert e.value.args[0] == error


class TestBuildTaskController:
    async def test_error_when_action_is_empty(self, task_worker, mock_session):
        with pytest.raises(CannotProceed) as e:
            await task_worker.build_task_controller(mock_session, make_item(action=None))
        assert e.value.args[0] == "Action is not defined in task"

    async def test_error_when_entity_id_is_empty(self, task_worker, mock_session):
        with pytest.raises(CannotProceed) as e:
            await task_worker.build_task_controller(mock_session, make_item(entity_id=None))
        assert e.value.args[0] == "Entity id is not defined in task"

    async def test_error_when_user_is_empty(self, task_worker, mock_session):
        with pytest.raises(CannotProceed) as e:
            await task_worker.build_task_controller(mock_session, make_item(payload={}))
        assert e.value.args[0] == "User is not defined in task"

    async def test_error_when_entity_controller_is_unknown(self, task_worker, mock_session, monkeypatch):
        user_service = Mock()
        user_service.get_dto_by_id = AsyncMock(return_value=Mock())
        monkeypatch.setattr(tw_mod, "get_user_service", lambda session: user_service)

        with pytest.raises(CannotProceed) as e:
            await task_worker.build_task_controller(mock_session, make_item(entity="unknown"))
        assert e.value.args[0] == "Unknown entity controller: unknown"


class TestProcessTask:
    async def test_success_completes_task(
        self, task_worker, mock_queue, mock_worker_service, mock_task_controller, monkeypatch
    ):
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        monkeypatch.setattr(tw_mod, "publish_notification_event", AsyncMock())
        item = make_item()

        await task_worker.process_task(item)

        mock_task_controller.start_pipeline.assert_awaited_once()
        mock_queue.complete.assert_awaited_once_with(item.id, task_worker.worker_id)
        mock_queue.fail.assert_not_awaited()
        mock_worker_service.increment_tasks_completed.assert_awaited_once()
        assert task_worker.current_task is None

    async def test_not_ready_requeues_with_delay(self, task_worker, mock_queue, mock_task_controller, monkeypatch):
        mock_task_controller.start_pipeline = AsyncMock(side_effect=ParentIsNotReady("parent"))
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        item = make_item(retries=1)

        await task_worker.process_task(item)

        mock_queue.requeue.assert_awaited_once_with(item.id, task_worker.worker_id, 10.0)
        mock_task_controller.make_retry.assert_awaited_once_with(1, 3)
        mock_queue.complete.assert_not_awaited()

    async def test_handled_failure_fails_task(self, task_worker, mock_queue, mock_task_controller, monkeypatch):
        mock_task_controller.start_pipeline = AsyncMock(side_effect=CannotProceed("broken"))
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        monkeypatch.setattr(tw_mod, "publish_notification_event", AsyncMock())
        item = make_item()

        await task_worker.process_task(item)

        mock_task_controller.make_failed.assert_awaited_once()
        mock_queue.fail.assert_awaited_once_with(item.id, task_worker.worker_id, "CannotProceed: broken")

    async def test_error_before_controller_fails_task(self, task_worker, mock_queue):
        item = make_item(action=None)

        await task_worker.process_task(item)

        mock_queue.fail.assert_awaited_once_with(
            item.id, task_worker.worker_id, "CannotProceed: Action is not defined in task"
        )

    async def test_records_success_metric(self, task_worker, mock_session, mock_task_controller, monkeypatch):
        mock_counter = Mock()
        monkeypatch.setattr(tw_mod, "task_executions_counter", mock_counter)
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        monkeypatch.setattr(task_worker, "_send_success_notification", AsyncMock())

        await task_worker.execute_task(mock_session, make_item(entity="source_code"))

        mock_counter.add.assert_called_once_with(1, {"job_type": "source_code", "status": "success"})

    async def test_records_error_metric(self, task_worker, mock_session, mock_task_controller, monkeypatch):
        mock_counter = Mock()
        monkeypatch.setattr(tw_mod, "task_executions_counter", mock_counter)
        mock_task_controller.start_pipeline = AsyncMock(side_effect=RuntimeError("boom"))
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        monkeypatch.setattr(task_worker, "handle_exception", AsyncMock())

        await task_worker.execute_task(mock_session, make_item(entity="source_code"))

        mock_counter.add.assert_called_once_with(1, {"job_type": "source_code", "status": "error"})


class TestRunOnce:
    async def test_returns_false_when_queue_is_empty(self, task_worker):
        assert await task_worker.run_once() is False

    async def test_claims_and_processes_task(self, task_worker, mock_queue, monkeypatch):
        item = make_item()
        mock_queue.claim = AsyncMock(return_value=item)
        process_task = AsyncMock()
        monkeypatch.setattr(task_worker, "process_task", process_task)

        assert await task_worker.run_once() is True

        process_task.assert_awaited_once_with(item)

    async def test_reaps_expired_task_before_claiming(self, task_worker, mock_queue, mock_task_controller, monkeypatch):
        item = make_item()
        mock_queue.claim_expired = AsyncMock(return_value=item)
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        monkeypatch.setattr(tw_mod, "publish_notification_event", AsyncMock())

        assert await task_worker.run_once() is True

        mock_queue.claim.assert_not_awaited()
        mock_task_controller.make_failed.assert_awaited_once()
        mock_queue.fail.assert_awaited_once_with(item.id, task_worker.worker_id, "Worker lost (lease expired)")

    async def test_draining_worker_does_not_claim(self, task_worker, mock_queue):
        task_worker.stop()

        assert await task_worker.run_once() is False
        mock_queue.claim.assert_not_awaited()


class TestLostLease:
    async def test_lost_lease_aborts_running_task_without_touching_queue(
        self, task_worker, mock_queue, mock_worker_service, mock_task_controller, monkeypatch
    ):
        started = asyncio.Event()

        async def long_pipeline():
            started.set()
            await asyncio.sleep(60)

        mock_task_controller.start_pipeline = AsyncMock(side_effect=long_pipeline)
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))
        mock_worker_service.save_worker = AsyncMock(return_value=task_worker.worker)
        mock_queue.heartbeat = AsyncMock(return_value=False)
        item = make_item()

        processing = asyncio.create_task(task_worker.process_task(item))
        await asyncio.wait_for(started.wait(), 1)
        await task_worker.heartbeat()
        await asyncio.wait_for(processing, 1)

        # The reaper owns the row now: no complete/fail/requeue from this worker
        mock_queue.complete.assert_not_awaited()
        mock_queue.fail.assert_not_awaited()
        mock_queue.requeue.assert_not_awaited()
        assert task_worker.current_task is None

    async def test_kept_lease_does_not_abort(self, task_worker, mock_queue, mock_worker_service):
        mock_worker_service.save_worker = AsyncMock(return_value=task_worker.worker)
        execution = asyncio.create_task(asyncio.sleep(60))
        task_worker._execution = execution
        task_worker.current_task = make_item()

        await task_worker.heartbeat()

        assert not execution.cancelled()
        execution.cancel()

    async def test_shutdown_cancellation_is_not_swallowed(self, task_worker, mock_task_controller, monkeypatch):
        started = asyncio.Event()

        async def long_pipeline():
            started.set()
            await asyncio.sleep(60)

        mock_task_controller.start_pipeline = AsyncMock(side_effect=long_pipeline)
        monkeypatch.setattr(task_worker, "build_task_controller", AsyncMock(return_value=mock_task_controller))

        processing = asyncio.create_task(task_worker.process_task(make_item()))
        await asyncio.wait_for(started.wait(), 1)
        processing.cancel()

        with pytest.raises(asyncio.CancelledError):
            await processing


class TestHeartbeat:
    async def test_extends_lease_of_current_task(self, task_worker, mock_queue, mock_worker_service):
        mock_worker_service.save_worker = AsyncMock(return_value=task_worker.worker)
        item = make_item()
        task_worker.current_task = item

        await task_worker.heartbeat()

        mock_worker_service.save_worker.assert_awaited_once()
        mock_queue.heartbeat.assert_awaited_once_with(
            item.id, task_worker.worker_id, task_worker.settings.WORKER_LEASE_SECONDS
        )


class TestNotifications:
    async def test_send_task_notification_success(self, task_worker, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "test_entity_123"
        mock_task_controller.logger.entity_name = "test_source_code"

        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        test_message = "Test notification message"
        await task_worker.send_task_notification(mock_task_controller, test_message)

        mock_publish.assert_awaited_once_with(
            NotificationEvent(
                message=test_message,
                title="Task Update",
                status="info",
                entity_id="test_entity_123",
                entity_type="test_source_code",
                event_type=EventType.EXECUTE,
            )
        )

    async def test_success_notification_message_format(self, task_worker, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "entity_789"
        mock_task_controller.logger.entity_name = "my_deployment"

        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        await task_worker._send_success_notification(mock_task_controller, "deploy")

        mock_publish.assert_awaited_once_with(
            NotificationEvent(
                message="Task deploy for my_deployment completed successfully.",
                title="My deployment deploy succeeded",
                status="success",
                entity_id="entity_789",
                entity_type="my_deployment",
                event_type=EventType.EXECUTE,
            )
        )

    async def test_generic_exception_notification(self, task_worker, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "failed_entity_123"
        mock_task_controller.logger.entity_name = "failed_resource"

        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_generic_exception(
                CannotProceed("Test error message"), mock_task_controller, "CannotProceed"
            )

        mock_publish.assert_awaited_once_with(
            NotificationEvent(
                message="Task  failed for failed_entity_123: CannotProceed",
                title="Failed resource task failed",
                status="error",
                entity_id="failed_entity_123",
                entity_type="failed_resource",
                event_type=EventType.EXECUTE,
            )
        )
        mock_task_controller.make_failed.assert_awaited_once()
        mock_task_controller.logger.save_log.assert_awaited_once()

    async def test_timeout_notification_on_max_retries(self, task_worker, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "timeout_entity_456"
        mock_task_controller.logger.entity_name = "timeout_storage"

        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        item = make_item(retries=3, max_retries=3)

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_is_not_ready_exception(
                ParentIsNotReady("Parent not ready"), item, mock_task_controller
            )

        mock_publish.assert_awaited_once_with(
            NotificationEvent(
                message="Task  failed for timeout_entity_456: Task is timed out",
                title="Timeout storage task timed out",
                status="error",
                entity_id="timeout_entity_456",
                entity_type="timeout_storage",
                event_type=EventType.EXECUTE,
            )
        )
        mock_task_controller.make_failed.assert_awaited_once()

    async def test_exit_without_save_notification(self, task_worker, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "exit_entity_789"
        mock_task_controller.logger.entity_name = "exit_workspace"

        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_exit_without_state_exception(
                ExitWithoutSave("Exit without saving changes"), mock_task_controller
            )

        mock_publish.assert_awaited_once_with(
            NotificationEvent(
                message="Task  failed for exit_entity_789: ExitWithoutSave: Exit without saving changes",
                title="Exit workspace task failed",
                status="error",
                entity_id="exit_entity_789",
                entity_type="exit_workspace",
                event_type=EventType.EXECUTE,
            )
        )

    async def test_unexpected_exception_notification(self, task_worker, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "unexpected_entity_000"
        mock_task_controller.logger.entity_name = "unexpected_resource"

        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_unexpected_exception(
                RuntimeError("Unexpected runtime error"), mock_task_controller
            )

        mock_publish.assert_awaited_once_with(
            NotificationEvent(
                message="Task  failed for unexpected_entity_000: UnhandledException: Unexpected runtime error",
                title="Unexpected resource task failed",
                status="error",
                entity_id="unexpected_entity_000",
                entity_type="unexpected_resource",
                event_type=EventType.EXECUTE,
            )
        )

    async def test_notification_with_different_entity_controllers(
        self, task_worker, mock_task_controller_factory, mocked_user, monkeypatch
    ):
        mock_publish = AsyncMock()
        monkeypatch.setattr(tw_mod, "publish_notification_event", mock_publish)

        test_cases = [
            ("storage_entity_123", "my_storage"),
            ("workspace_entity_456", "dev_workspace"),
            ("resource_entity_789", "api_resource"),
        ]

        for entity_id, entity_name in test_cases:
            controller = mock_task_controller_factory(entity_id=entity_id, entity_name=entity_name, user=mocked_user)
            await task_worker.send_task_notification(controller, f"Test message for {entity_name}")

        assert mock_publish.await_count == 3
        for entity_id, entity_name in test_cases:
            mock_publish.assert_any_await(
                NotificationEvent(
                    message=f"Test message for {entity_name}",
                    title="Task Update",
                    status="info",
                    entity_id=entity_id,
                    entity_type=entity_name,
                    event_type=EventType.EXECUTE,
                )
            )
