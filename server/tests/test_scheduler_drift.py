from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

import scheduler
from application.resource_drifts.model import DriftSettingsDTO
from core.constants.model import ModelActions
from core.utils.event_sender import EventSender


@pytest.fixture
def event_sender():
    sender = Mock(spec=EventSender)
    sender.send_task = AsyncMock()
    sender.flush = AsyncMock()
    return sender


@pytest.fixture
def drift_enabled():
    """Drift detection is on globally."""
    with patch.object(scheduler, "get_drift_settings", AsyncMock(return_value=DriftSettingsDTO(enabled=True))):
        yield


@pytest.fixture
def drift_disabled():
    """Drift detection is off globally, only projects that opted in are checked."""
    with patch.object(scheduler, "get_drift_settings", AsyncMock(return_value=DriftSettingsDTO(enabled=False))):
        yield


def patched_scheduler(rows, user):
    session = Mock(execute=AsyncMock(return_value=Mock(all=Mock(return_value=rows))), scalar=AsyncMock(return_value=0))

    @asynccontextmanager
    async def fake_session():
        yield session

    user_service = Mock(get_dto_by_id=AsyncMock(return_value=user))
    return (
        patch.object(scheduler, "get_async_session", fake_session),
        patch.object(scheduler, "UserService", return_value=user_service),
        session,
    )


async def test_due_resources_get_a_drift_check_task(drift_enabled, event_sender, mock_user_dto):
    creator = uuid4()
    rows = [(uuid4(), creator), (uuid4(), creator)]
    session_patch, user_patch, session = patched_scheduler(rows, mock_user_dto)

    with session_patch, user_patch:
        await scheduler.enqueue_drift_checks(event_sender)

    assert event_sender.send_task.await_count == 2
    kwargs = event_sender.send_task.call_args.kwargs
    assert kwargs["action"] == ModelActions.CHECK_DRIFT
    assert kwargs["requester"] == mock_user_dto
    assert kwargs["extra_metadata"] == {"entity_controller": "resource"}
    assert kwargs["delay_seconds"] == 0
    event_sender.flush.assert_awaited_once()


async def test_batch_size_from_the_settings_limits_the_query(event_sender, mock_user_dto):
    settings = DriftSettingsDTO(enabled=True, batch_size=7)
    session_patch, user_patch, session = patched_scheduler([(uuid4(), uuid4())], mock_user_dto)

    with session_patch, user_patch, patch.object(scheduler, "get_drift_settings", AsyncMock(return_value=settings)):
        await scheduler.enqueue_drift_checks(event_sender)

    query = _query(session)
    assert "coalesce" in query.lower()
    assert "position <= " in query
    assert "7) AS quota" in query


async def test_projects_can_override_the_interval_and_batch_size(event_sender, mock_user_dto):
    session_patch, user_patch, session = patched_scheduler([(uuid4(), uuid4())], mock_user_dto)

    with (
        session_patch,
        user_patch,
        patch.object(scheduler, "get_drift_settings", AsyncMock(return_value=DriftSettingsDTO(enabled=True))),
    ):
        await scheduler.enqueue_drift_checks(event_sender)

    query = _query(session)
    assert "drift_interval_hours" in query
    assert "drift_batch_size" in query


def _query(session) -> str:
    return str(session.execute.call_args.args[0].compile(compile_kwargs={"literal_binds": True}))


async def test_all_provisioned_resources_are_checked_when_enabled_globally(drift_enabled, event_sender, mock_user_dto):
    session_patch, user_patch, session = patched_scheduler([(uuid4(), uuid4())], mock_user_dto)

    with session_patch, user_patch:
        await scheduler.enqueue_drift_checks(event_sender)

    assert "drift_detection" not in _query(session)


async def test_only_opted_in_projects_are_checked_when_disabled_globally(drift_disabled, event_sender, mock_user_dto):
    session_patch, user_patch, session = patched_scheduler([(uuid4(), uuid4())], mock_user_dto)

    with session_patch, user_patch:
        await scheduler.enqueue_drift_checks(event_sender)

    assert "drift_detection" in _query(session)


async def test_resources_of_unknown_users_are_skipped(drift_enabled, event_sender):
    session_patch, user_patch, _ = patched_scheduler([(uuid4(), uuid4())], None)

    with session_patch, user_patch:
        await scheduler.enqueue_drift_checks(event_sender)

    event_sender.send_task.assert_not_awaited()


def test_drift_job_is_internal_and_scheduled(event_sender):
    scheduler_mock = Mock()

    scheduler.schedule_drift_check_job(scheduler_mock, event_sender)

    assert scheduler.DRIFT_CHECK_JOB_ID in scheduler.INTERNAL_JOB_IDS
    assert scheduler_mock.add_job.call_args.kwargs["id"] == scheduler.DRIFT_CHECK_JOB_ID


async def test_scheduled_checks_have_a_low_priority(drift_enabled, event_sender, mock_user_dto):
    session_patch, user_patch, _ = patched_scheduler([(uuid4(), uuid4())], mock_user_dto)

    with session_patch, user_patch:
        await scheduler.enqueue_drift_checks(event_sender)

    assert event_sender.send_task.call_args.kwargs["priority"] < 0


async def test_nothing_is_queued_while_the_active_check_limit_is_reached(drift_enabled, event_sender, mock_user_dto):
    session_patch, user_patch, session = patched_scheduler([(uuid4(), uuid4())], mock_user_dto)
    session.scalar = AsyncMock(return_value=scheduler.DRIFT_MAX_ACTIVE_CHECKS)

    with session_patch, user_patch:
        await scheduler.enqueue_drift_checks(event_sender)

    event_sender.send_task.assert_not_awaited()
    session.execute.assert_not_awaited()
