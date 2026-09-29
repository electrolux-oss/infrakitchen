from contextlib import asynccontextmanager
from datetime import UTC, datetime
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

import scheduler
from core.constants.model import ModelActions, ModelStatus
from core.utils.event_sender import EventSender


@pytest.fixture
def event_sender():
    sender = Mock(spec=EventSender)
    sender.send_task = AsyncMock()
    sender.flush = AsyncMock()
    return sender


@pytest.fixture
def session():
    return Mock(commit=AsyncMock())


def recurring_task(status: ModelStatus):
    return Mock(
        id=uuid4(),
        entity_id=uuid4(),
        entity="resource",
        action=ModelActions.EXECUTE,
        created_by=uuid4(),
        cron="*/5 * * * *",
        timezone="UTC",
        run_at=datetime.now(UTC),
        status=status,
        state=None,
    )


@pytest.fixture
def patched(session, mock_user_dto):
    @asynccontextmanager
    async def fake_session():
        yield session

    crud = Mock(get_by_id=AsyncMock(), update=AsyncMock())
    user_service = Mock(get_dto_by_id=AsyncMock(return_value=mock_user_dto))
    with (
        patch.object(scheduler, "get_async_session", fake_session),
        patch.object(scheduler, "TaskEntityCRUD", return_value=crud),
        patch.object(scheduler, "UserService", return_value=user_service),
    ):
        yield crud


class TestRunRecurringEntityAction:
    async def test_sends_task_and_advances_run_at(self, patched, session, event_sender, mock_user_dto):
        task = recurring_task(ModelStatus.DONE)
        patched.get_by_id.return_value = task

        await scheduler.run_entity_action(task.id, event_sender)

        event_sender.send_task.assert_awaited_once_with(
            entity_id=task.entity_id,
            requester=mock_user_dto,
            action="execute",
            extra_metadata={"entity_controller": "resource"},
        )
        next_run = patched.update.call_args.args[1]["run_at"]
        assert next_run > datetime.now(UTC)
        session.commit.assert_awaited_once()

    async def test_skips_when_previous_run_in_progress(self, patched, session, event_sender):
        task = recurring_task(ModelStatus.IN_PROGRESS)
        patched.get_by_id.return_value = task

        await scheduler.run_entity_action(task.id, event_sender)

        event_sender.send_task.assert_not_awaited()
        patched.update.assert_awaited_once()
        session.commit.assert_awaited_once()
