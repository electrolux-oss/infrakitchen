from contextlib import asynccontextmanager
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

import scheduler
from application.resource_drifts.model import DriftSettingsDTO
from application.resources.crud import ResourceCRUD
from core.constants.model import ModelActions
from core.utils.event_sender import EventSender


@pytest.fixture
def event_sender():
    sender = Mock(spec=EventSender)
    sender.send_task = AsyncMock()
    sender.flush = AsyncMock()
    return sender


def fake_session_factory(session):
    @asynccontextmanager
    async def fake_session():
        yield session

    return fake_session


class Job:
    """The drift job with its collaborators patched."""

    def __init__(self, due_ids, active_checks=0, enabled=True, locked=True, user=None):
        self.session = Mock(scalar=AsyncMock(return_value=locked), commit=AsyncMock())
        self.resource_crud = Mock(get_due_for_drift_check=AsyncMock(return_value=due_ids))
        self.task_queue_crud = Mock(count_active=AsyncMock(return_value=active_checks))
        self.settings_service = Mock(get=AsyncMock(return_value=DriftSettingsDTO(enabled=enabled, interval_hours=6)))
        self.get_user = AsyncMock(return_value=user or Mock(id=uuid4()))

    async def run(self, event_sender) -> int:
        with (
            patch.object(scheduler, "get_async_session", fake_session_factory(self.session)),
            patch.object(scheduler, "ResourceCRUD", return_value=self.resource_crud),
            patch.object(scheduler, "TaskQueueCRUD", return_value=self.task_queue_crud),
            patch.object(scheduler, "get_drift_settings_service", return_value=self.settings_service),
            patch.object(scheduler, "get_drift_system_user", self.get_user),
        ):
            return await scheduler.enqueue_drift_checks(event_sender)


async def test_due_resources_get_a_low_priority_drift_check_as_the_system_user(event_sender, mock_user_dto):
    job = Job([uuid4(), uuid4()], user=mock_user_dto)

    assert await job.run(event_sender) == 2

    assert event_sender.send_task.await_count == 2
    kwargs = event_sender.send_task.call_args.kwargs
    assert kwargs["action"] == ModelActions.CHECK_DRIFT
    assert kwargs["requester"] == mock_user_dto
    assert kwargs["extra_metadata"] == {"entity_controller": "resource"}
    assert kwargs["delay_seconds"] == 0
    assert kwargs["priority"] < 0
    event_sender.flush.assert_awaited_once()
    job.session.commit.assert_awaited_once()


async def test_the_queue_is_topped_up_to_the_active_check_limit(event_sender):
    job = Job([uuid4()], active_checks=scheduler.DRIFT_MAX_ACTIVE_CHECKS - 3)

    await job.run(event_sender)

    job.task_queue_crud.count_active.assert_awaited_once_with(ModelActions.CHECK_DRIFT)
    assert job.resource_crud.get_due_for_drift_check.call_args.args == (True, 6, 3)


async def test_nothing_is_queued_while_the_active_check_limit_is_reached(event_sender):
    job = Job([uuid4()], active_checks=scheduler.DRIFT_MAX_ACTIVE_CHECKS)

    assert await job.run(event_sender) == 0

    job.resource_crud.get_due_for_drift_check.assert_not_awaited()
    event_sender.send_task.assert_not_awaited()


async def test_the_system_user_is_needed_only_when_a_check_is_due(event_sender):
    # so it isn't created while drift detection is unused
    job = Job([])

    assert await job.run(event_sender) == 0

    job.get_user.assert_not_awaited()
    event_sender.flush.assert_not_awaited()


async def test_another_scheduler_holding_the_lock_skips_the_run(event_sender):
    job = Job([uuid4()], locked=False)

    assert await job.run(event_sender) == 0

    job.task_queue_crud.count_active.assert_not_awaited()
    event_sender.send_task.assert_not_awaited()
    job.session.commit.assert_not_awaited()


async def test_the_global_setting_is_passed_to_the_query(event_sender):
    job = Job([], enabled=False)

    await job.run(event_sender)

    assert job.resource_crud.get_due_for_drift_check.call_args.args[0] is False


class TestSystemUser:
    @staticmethod
    def user_crud(existing):
        created = Mock(id=uuid4())
        return Mock(
            get_one=AsyncMock(return_value=existing),
            create=AsyncMock(return_value=created),
            get_by_id=AsyncMock(return_value=Mock(name="created user")),
        )

    async def get_user(self, crud, session):
        with (
            patch.object(scheduler, "get_async_session", fake_session_factory(session)),
            patch.object(scheduler, "UserCRUD", return_value=crud),
            patch.object(scheduler.UserDTO, "model_validate", side_effect=lambda user: user),
        ):
            return await scheduler.get_drift_system_user()

    async def test_is_created_without_a_login_provider(self):
        crud, session = self.user_crud(existing=None), Mock(commit=AsyncMock())

        user = await self.get_user(crud, session)

        assert user is crud.get_by_id.return_value
        body = crud.create.call_args.args[0]
        assert (body["identifier"], body["provider"]) == (scheduler.DRIFT_SYSTEM_USER_IDENTIFIER, "system")
        session.commit.assert_awaited_once()

    async def test_is_looked_up_with_its_provider_on_every_run(self):
        # a user of a real provider may have the same identifier
        existing = Mock()
        crud, session = self.user_crud(existing=existing), Mock(commit=AsyncMock())

        assert await self.get_user(crud, session) is existing
        assert await self.get_user(crud, session) is existing

        # not cached in the process: a changed or recreated user is picked up
        assert crud.get_one.await_count == 2
        crud.get_one.assert_awaited_with(
            filter={"identifier": scheduler.DRIFT_SYSTEM_USER_IDENTIFIER, "provider": "system"}
        )
        crud.create.assert_not_awaited()


def test_drift_job_is_internal_and_scheduled(event_sender):
    scheduler_mock = Mock()

    scheduler.schedule_drift_check_job(scheduler_mock, event_sender)

    assert scheduler.DRIFT_CHECK_JOB_ID in scheduler.INTERNAL_JOB_IDS
    assert scheduler_mock.add_job.call_args.kwargs["id"] == scheduler.DRIFT_CHECK_JOB_ID


async def due_query(enabled_globally: bool = True, interval_hours: int = 24, limit: int = 10) -> str:
    session = Mock(execute=AsyncMock(return_value=Mock(scalars=Mock(return_value=Mock(all=Mock(return_value=[]))))))
    await ResourceCRUD(session).get_due_for_drift_check(enabled_globally, interval_hours, limit)
    statement = session.execute.call_args.args[0]
    return str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


def _drift_condition(query: str) -> str:
    """The project drift_detection condition of the candidate query."""
    start = query.index("drift_detection")
    return query[start : query.index("resource_drifts.id IS NULL", start)]


class TestDueResources:
    async def test_all_resources_except_opted_out_projects_when_enabled_globally(self):
        # projects without the setting (and resources without a project) follow the global one
        assert "IS NULL OR" in _drift_condition(await due_query(enabled_globally=True))

    async def test_only_opted_in_projects_when_disabled_globally(self):
        assert "IS NULL OR" not in _drift_condition(await due_query(enabled_globally=False))

    async def test_only_resources_a_check_can_run_on(self):
        query = await due_query()
        assert "resources.state = 'PROVISIONED'" in query
        assert "resources.abstract IS false" in query
        assert "source_codes.source_code_language = 'opentofu'" in query

    async def test_only_resources_without_pending_changes_are_checked(self):
        # the plan of a READY (changes not applied yet) or ERROR (half applied) resource would show them as drift
        query = await due_query()
        assert "resources.status = 'DONE'" in query
        assert "'READY'" not in query and "'ERROR'" not in query

    async def test_outdated_results_are_checked_first(self):
        query = await due_query()
        # a result outdated by an apply (UNKNOWN) is due right away, like a resource that was never checked;
        # unless the checks after the apply failed, then it backs off like any failing check
        outdated = (
            "resource_drifts.id IS NULL OR resource_drifts.status = 'UNKNOWN' "
            "AND resource_drifts.consecutive_failures <= 0"
        )
        assert outdated in query
        assert f"ORDER BY CASE WHEN ({outdated})" in query
        assert "ELSE resource_drifts.checked_at END ASC NULLS FIRST" in query
        assert query.rstrip().endswith("LIMIT 10")

    async def test_failed_checks_back_off_up_to_the_interval(self):
        query = await due_query(interval_hours=24)
        failing = "resource_drifts.consecutive_failures > 0"
        assert (
            f"CASE WHEN ({failing}) THEN resource_drifts.last_error_at ELSE resource_drifts.checked_at END "
            "< now() - make_interval(0, 0, 0, 0, CASE WHEN "
            f"({failing}) THEN least(24, CAST(power(2, least(resource_drifts.consecutive_failures, 15) - 1) "
            "AS INTEGER)) ELSE 24 END)"
        ) in query

    async def test_resources_with_an_active_task_are_skipped(self):
        query = await due_query()
        assert "NOT (EXISTS (SELECT" in query
        assert "task_queue.status IN ('queued', 'running')" in query
