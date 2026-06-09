# pyright: reportAttributeAccessIssue=false
import asyncio
import json

import pytest
from unittest.mock import Mock, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession
from application.workers import TaskWorker
from core.notifications.controller import NotificationEvent
from core.errors import CannotProceed
from core.scheduler.executor import SchedulerExecutor

import application.workers.task_worker as tw_mod


@pytest.fixture
def mock_session():
    session = Mock(spec=AsyncSession)
    return session


class TestTaskWorker:
    # TODO: Fix this test
    # @pytest.mark.asyncio
    # async def test_process_task_message_success(self,
    # mock_session, mock_task_controller, mock_user_crud, monkeypatch):
    #     message_raw_body = {
    #         "_metadata": {
    #             "_message_type": "task",
    #             "id": "id",
    #             "action": "action",
    #             "user": "user",
    #             "entity_controller": "source_code",
    #         }
    #     }
    #     json_str = json.dumps(message_raw_body)
    #     message = Mock(spec=tw_mod.MessageHandler)
    #     message.raw_body = json_str.encode("utf-8")
    #
    #     mock_user_crud.get_by_id = AsyncMock(return_value=mock_task_controller.user)
    #     monkeypatch.setattr(tw_mod, "UserCRUD", lambda session: mock_user_crud)
    #
    #     async def mock_get_source_code_task(session, obj_id, user, action, trace_id=None):
    #         return mock_task_controller
    #
    #     monkeypatch.setattr(tw_mod, "get_source_code_task", mock_get_source_code_task)
    #
    #     mock_create_message = Mock(return_value="mock_notification_message")
    #     mock_send_message = AsyncMock()
    #     monkeypatch.setattr(tw_mod, "create_message", mock_create_message)
    #     monkeypatch.setattr(tw_mod, "send_message", mock_send_message)
    #
    #     task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
    #
    #     await task_worker.process_message(message=message)
    #
    #     mock_task_controller.start_pipeline.assert_awaited_once()
    #     mock_user_crud.get_by_id.assert_awaited_once()
    #     mock_send_message.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_process_scheduler_message_success(self, mock_session, monkeypatch):
        message_raw_body = {
            "_metadata": {
                "_message_type": "scheduler_job",
            },
            "job_id": "abc123",
            "job_type": "SQL",
            "job_script": "DELETE from logs",
        }

        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        mock_executor = Mock(spec=SchedulerExecutor)
        mock_executor.execute = AsyncMock()
        monkeypatch.setattr(tw_mod, "SchedulerExecutor", lambda session: mock_executor)

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        await task_worker.process_message(message=message)

        mock_executor.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_process_task_message_error_when_action_is_empty(self, mock_session):
        message_raw_body = {
            "_metadata": {"_message_type": "task", "id": "id", "user": "user", "entity_controller": "source_code"}
        }
        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "Action is not defined in message"

    @pytest.mark.asyncio
    async def test_process_task_message_error_when_id_is_empty(self, mock_session):
        message_raw_body = {
            "_metadata": {
                "_message_type": "task",
                "action": "action",
                "user": "user",
                "entity_controller": "source_code",
            }
        }
        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "InventoryId is not defined in message"

    @pytest.mark.asyncio
    async def test_process_task_message_error_when_user_is_empty(self, mock_session):
        message_raw_body = {
            "_metadata": {"_message_type": "task", "action": "action", "id": "id", "entity_controller": "source_code"}
        }
        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "User is not defined in message"

    @pytest.mark.asyncio
    async def test_process_task_message_error_when_entity_controller_is_empty(self, mock_session):
        message_raw_body = {"_metadata": {"_message_type": "task", "action": "action", "id": "id", "user": "user"}}
        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "Entity controller is not defined in message"

    # TODO: Fix this test
    # @pytest.mark.asyncio
    # async def test_process_task_message_error_when_user_is_not_found(self, mock_session, mock_user_crud, monkeypatch):
    #     message_raw_body = {
    #         "_metadata": {
    #             "_message_type": "task",
    #             "action": "action",
    #             "id": "id",
    #             "user": "user",
    #             "entity_controller": "source_code",
    #         }
    #     }
    #     json_str = json.dumps(message_raw_body)
    #     message = Mock(spec=tw_mod.MessageHandler)
    #     message.raw_body = json_str.encode("utf-8")
    #
    #     mock_user_crud.get_by_id = AsyncMock(return_value=None)
    #     monkeypatch.setattr(tw_mod, "UserCRUD", lambda session: mock_user_crud)
    #
    #     task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
    #
    #     with pytest.raises(CannotProceed) as e:
    #         await task_worker.process_message(message=message)
    #
    #     assert e.type is CannotProceed
    #     assert e.value.args[0] == "User user not found"

    @pytest.mark.asyncio
    async def test_process_scheduler_message_error_when_job_id_is_empty(self, mock_session, monkeypatch):
        message_raw_body = {
            "_metadata": {
                "_message_type": "scheduler_job",
            },
            "job_type": "SQL",
            "job_script": "DELETE from logs",
        }

        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "Scheduler job_id is not defined in message"

    @pytest.mark.asyncio
    async def test_process_scheduler_message_error_when_job_type_is_empty(self, mock_session, monkeypatch):
        message_raw_body = {
            "_metadata": {
                "_message_type": "scheduler_job",
            },
            "job_id": "abc123",
            "job_script": "DELETE from logs",
        }

        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "Scheduler job_type is not defined in message"

    @pytest.mark.asyncio
    async def test_process_scheduler_message_error_when_job_script_is_empty(self, mock_session, monkeypatch):
        message_raw_body = {
            "_metadata": {
                "_message_type": "scheduler_job",
            },
            "job_id": "abc123",
            "job_type": "SQL",
        }

        json_str = json.dumps(message_raw_body)
        message = Mock(spec=tw_mod.MessageHandler)
        message.raw_body = json_str.encode("utf-8")

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())

        with pytest.raises(CannotProceed) as e:
            await task_worker.process_message(message=message)

        assert e.type is CannotProceed
        assert e.value.args[0] == "Scheduler job_script is not defined in message"

    @pytest.mark.asyncio
    async def test_send_task_notification_success(self, mock_session, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "test_entity_123"
        mock_task_controller.logger.entity_name = "test_source_code"

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        test_message = "Test notification message"
        await task_worker.send_task_notification(mock_task_controller, test_message)

        task_worker.notification_controller.route_notification.assert_awaited_once_with(
            NotificationEvent(
                message=test_message,
                title="Task Update",
                status="info",
                entity_id="test_entity_123",
                entity_type="test_source_code",
                event_type="update",
            )
        )

    @pytest.mark.asyncio
    async def test_success_notification_message_format(self, mock_session, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "entity_789"
        mock_task_controller.logger.entity_name = "my_deployment"

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        action = "deploy"
        await task_worker._send_success_notification(mock_task_controller, action)

        expected_message = "Task deploy for my_deployment completed successfully."
        task_worker.notification_controller.route_notification.assert_awaited_once_with(
            NotificationEvent(
                message=expected_message,
                title="My deployment deploy succeeded",
                status="success",
                entity_id="entity_789",
                entity_type="my_deployment",
                event_type="update",
            )
        )

    @pytest.mark.asyncio
    async def test_generic_exception_notification(self, mock_session, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "failed_entity_123"
        mock_task_controller.logger.entity_name = "failed_resource"

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        test_exception = CannotProceed("Test error message")

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_generic_exception(test_exception, mock_task_controller, "CannotProceed")

        expected_message = "Task  failed for failed_entity_123: CannotProceed"
        task_worker.notification_controller.route_notification.assert_awaited_once_with(
            NotificationEvent(
                message=expected_message,
                title="Failed resource task failed",
                status="error",
                entity_id="failed_entity_123",
                entity_type="failed_resource",
                event_type="update",
            )
        )

        mock_task_controller.make_failed.assert_awaited_once()
        mock_task_controller.logger.save_log.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_timeout_notification_on_max_retries(self, mock_session, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "timeout_entity_456"
        mock_task_controller.logger.entity_name = "timeout_storage"

        mock_message = Mock()
        mock_message.retries = 3
        mock_message.max_retries = 3

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        from core.errors import ParentIsNotReady

        test_exception = ParentIsNotReady("Parent not ready")

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_is_not_ready_exception(test_exception, mock_message, mock_task_controller)

        expected_message = "Task  failed for timeout_entity_456: Task is timed out"
        task_worker.notification_controller.route_notification.assert_awaited_once_with(
            NotificationEvent(
                message=expected_message,
                title="Timeout storage task timed out",
                status="error",
                entity_id="timeout_entity_456",
                entity_type="timeout_storage",
                event_type="update",
            )
        )

    @pytest.mark.asyncio
    async def test_exit_without_save_notification(self, mock_session, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "exit_entity_789"
        mock_task_controller.logger.entity_name = "exit_workspace"

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        from core.errors import ExitWithoutSave

        test_exception = ExitWithoutSave("Exit without saving changes")

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_exit_without_state_exception(test_exception, mock_task_controller)

        expected_message = "Task  failed for exit_entity_789: ExitWithoutSave: Exit without saving changes"
        task_worker.notification_controller.route_notification.assert_awaited_once_with(
            NotificationEvent(
                message=expected_message,
                title="Exit workspace task failed",
                status="error",
                entity_id="exit_entity_789",
                entity_type="exit_workspace",
                event_type="update",
            )
        )

    @pytest.mark.asyncio
    async def test_unexpected_exception_notification(self, mock_session, mock_task_controller, monkeypatch):
        mock_task_controller.logger.entity_id = "unexpected_entity_000"
        mock_task_controller.logger.entity_name = "unexpected_resource"

        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        test_exception = RuntimeError("Unexpected runtime error")

        with pytest.raises(tw_mod.TaskFailure):
            await task_worker.handle_unexpected_exception(test_exception, mock_task_controller)

        expected_message = "Task  failed for unexpected_entity_000: UnhandledException: Unexpected runtime error"
        task_worker.notification_controller.route_notification.assert_awaited_once_with(
            NotificationEvent(
                message=expected_message,
                title="Unexpected resource task failed",
                status="error",
                entity_id="unexpected_entity_000",
                entity_type="unexpected_resource",
                event_type="update",
            )
        )

    @pytest.mark.asyncio
    async def test_notification_with_different_entity_controllers(
        self, mock_session, mock_task_controller_factory, mocked_user, monkeypatch
    ):
        task_worker = TaskWorker(session=mock_session, name="task_worker", lock=asyncio.Lock())
        task_worker.notification_controller = Mock()
        task_worker.notification_controller.route_notification = AsyncMock()

        test_cases = [
            ("storage_entity_123", "my_storage"),
            ("workspace_entity_456", "dev_workspace"),
            ("resource_entity_789", "api_resource"),
        ]

        for entity_id, entity_name in test_cases:
            controller = mock_task_controller_factory(entity_id=entity_id, entity_name=entity_name, user=mocked_user)

            test_message = f"Test message for {entity_name}"
            await task_worker.send_task_notification(controller, test_message)

        assert task_worker.notification_controller.route_notification.await_count == 3

        task_worker.notification_controller.route_notification.assert_any_await(
            NotificationEvent(
                message="Test message for my_storage",
                title="Task Update",
                status="info",
                entity_id="storage_entity_123",
                entity_type="my_storage",
                event_type="update",
            )
        )
        task_worker.notification_controller.route_notification.assert_any_await(
            NotificationEvent(
                message="Test message for dev_workspace",
                title="Task Update",
                status="info",
                entity_id="workspace_entity_456",
                entity_type="dev_workspace",
                event_type="update",
            )
        )
        task_worker.notification_controller.route_notification.assert_any_await(
            NotificationEvent(
                message="Test message for api_resource",
                title="Task Update",
                status="info",
                entity_id="resource_entity_789",
                entity_type="api_resource",
                event_type="update",
            )
        )
