from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from core.constants.model import ModelActions, ModelStatus
from core.tasks.crud import TaskEntityCRUD
from core.tasks.schema import TaskScheduleCreate
from core.tasks.service import TaskEntityService
from core.utils.event_sender import EventSender


@pytest.fixture
def task_crud():
    crud = Mock(spec=TaskEntityCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_one = AsyncMock(return_value=None)
    crud.create = AsyncMock(side_effect=lambda body: Mock(**body))
    crud.update = AsyncMock(side_effect=lambda task, body: task)
    return crud


@pytest.fixture
def event_sender():
    sender = Mock(spec=EventSender)
    sender.send_reload_event = AsyncMock()
    return sender


@pytest.fixture
def task_service(task_crud, event_sender):
    return TaskEntityService(crud=task_crud, event_sender=event_sender)


def schedule(**kwargs) -> TaskScheduleCreate:
    return TaskScheduleCreate(entity_id=uuid4(), entity="resource", action=ModelActions.EXECUTE, **kwargs)


class TestUpsertScheduled:
    async def test_create_recurring(self, task_service, task_crud, event_sender, mock_user_dto):
        await task_service.upsert_scheduled(schedule(cron="0 2 * * *", timezone="Europe/Stockholm"), mock_user_dto)

        body = task_crud.create.call_args.args[0]
        assert body["cron"] == "0 2 * * *"
        assert body["timezone"] == "Europe/Stockholm"
        assert body["status"] == ModelStatus.PENDING
        assert body["run_at"] > datetime.now(UTC)
        assert body["created_by"] == mock_user_dto.id
        event_sender.send_reload_event.assert_awaited_once_with("reload_scheduler_jobs")

    async def test_switch_recurring_to_one_time_clears_cron(self, task_service, task_crud, mock_user_dto):
        existing = Mock(cron="0 2 * * *", timezone="UTC")
        task_crud.get_one.return_value = existing
        run_at = datetime.now(UTC) + timedelta(hours=1)

        await task_service.upsert_scheduled(schedule(run_at=run_at), mock_user_dto)

        body = task_crud.update.call_args.args[1]
        assert body["run_at"] == run_at
        assert body["cron"] is None
        assert body["timezone"] is None
        assert body["status"] == ModelStatus.PENDING
        task_crud.create.assert_not_awaited()


class TestCancelScheduled:
    async def test_cancel_recurring_keeps_status(self, task_service, task_crud, event_sender):
        task = Mock(cron="0 2 * * *", timezone="UTC", run_at=datetime.now(UTC), status=ModelStatus.DONE)
        task_crud.get_by_id.return_value = task

        await task_service.cancel_scheduled(uuid4())

        task_crud.update.assert_awaited_once_with(task, {"cron": None, "timezone": None, "run_at": None})
        event_sender.send_reload_event.assert_awaited_once()

    async def test_cancel_one_time_sets_cancelled(self, task_service, task_crud):
        task = Mock(cron=None, run_at=datetime.now(UTC), status=ModelStatus.PENDING)
        task_crud.get_by_id.return_value = task

        await task_service.cancel_scheduled(uuid4())

        task_crud.update.assert_awaited_once_with(task, {"status": ModelStatus.CANCELLED})
