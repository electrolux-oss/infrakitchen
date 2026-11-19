import asyncio
from datetime import UTC, datetime
from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.resource_drifts.model import ResourceDrift
from application.resource_drifts.service import ResourceDriftService
from application.resources.drift_task import ResourceDriftTask
from application.resources.functions import (
    DRIFT_NEEDS_DONE,
    drift_check_blocker,
    get_resource_actions,
    resource_supports_drift_check,
    validate_drift_action,
)
from application.resources.task import ResourceTask
from application.tools.tf_drift import DriftResult
from core.constants.model import DriftStatus, ModelActions, ModelState, ModelStatus
from core.errors import EntityWrongState, ExitWithoutSave

BUCKET = "aws_s3_bucket.this"
ROLE = "aws_iam_role.app"


def make_resource(**overrides: Any) -> Mock:
    """A provisioned OpenTofu resource a drift check can run on."""
    resource = Mock(integration_ids=[], storage=None, abstract=False)
    resource.state = ModelState.PROVISIONED
    resource.status = ModelStatus.DONE
    resource.name = "orders-db"
    resource.id = uuid4()
    resource.source_code_version.source_code.source_code_language = "opentofu"
    for key, value in overrides.items():
        setattr(resource, key, value)
    return resource


def make_task(
    drift_service: ResourceDriftService | None = None,
    action: ModelActions = ModelActions.CHECK_DRIFT,
    task_class: type[ResourceTask] = ResourceDriftTask,
) -> Any:
    return task_class(
        session=Mock(commit=AsyncMock()),
        crud_resource=Mock(),
        resource_service=Mock(),
        resource_instance=make_resource(),
        source_code_version_service=Mock(),
        task_service=Mock(),
        logger=Mock(save_log=AsyncMock()),
        secret_manager=Mock(),
        user=Mock(identifier="admin@example.com"),
        event_sender=Mock(send_event=AsyncMock(), flush=AsyncMock()),
        action=action,
        workspace_root="/tmp/ik-test",
        drift_service=drift_service or Mock(),
    )


def result_of(*addresses: str, total: int | None = None) -> DriftResult:
    """A drift result with one changed `tags.Owner` per address."""
    changes = [
        {"address": address, "action": "update", "attributes": [{"path": "tags.Owner", "before": "1", "after": "2"}]}
        for address in addresses
    ]
    summary = {
        "drifted": bool(addresses),
        "total": len(addresses) if total is None else total,
        "source": "json",
        "changes": changes,
    }
    return DriftResult(summary=summary, keys=[f"{address}|tags.Owner" for address in addresses])


def make_drift_task(
    monkeypatch,
    drift_service: ResourceDriftService,
    drift_result: DriftResult | None,
    previous_status: DriftStatus | None = None,
    known_drift: list[str] | None = None,
) -> tuple[Any, AsyncMock]:
    """A drift check task whose tofu run returns `drift_result` (None: it fails)."""
    task = make_task(drift_service)
    task.init_workspace = AsyncMock()
    task.init_provision_tool = AsyncMock()
    task.clean_workspace = AsyncMock()
    task.workspace_path = "/tmp/ik-test"
    task.source_code_instance = Mock(source_code_language="opentofu")
    drift_check = (
        AsyncMock(return_value=drift_result)
        if drift_result is not None
        else AsyncMock(side_effect=RuntimeError("boom"))
    )
    task.tf_client = Mock(init=AsyncMock(), drift_check=drift_check)
    if previous_status is not None:
        crud = cast(Any, drift_service.crud)
        crud.rows[task.resource_instance.id] = ResourceDrift(
            resource_id=task.resource_instance.id,
            status=previous_status,
            checked_at=datetime.now(UTC),
            known_drift=known_drift,
            consecutive_failures=0,
        )
    publish = AsyncMock()
    monkeypatch.setattr("application.resources.drift_task.publish_notification_event", publish)
    return task, publish


def drift_of(task: ResourceDriftTask) -> ResourceDrift | None:
    return cast(Any, task.drift_service.crud).rows.get(task.resource_instance.id)


async def test_check_drift_in_sync_saves_and_commits_the_result_without_notification(
    monkeypatch, resource_drift_service
):
    task, publish = make_drift_task(monkeypatch, resource_drift_service, result_of())

    await task.check_drift()

    drift = drift_of(task)
    assert drift is not None
    assert (drift.status, drift.known_drift) == (DriftStatus.IN_SYNC, [])
    # the provisioning state and status are not touched by a drift check
    assert task.resource_instance.state == ModelState.PROVISIONED
    assert task.resource_instance.status == ModelStatus.DONE
    # the task commits the result and sends its event, as change_entity_status does
    task.session.commit.assert_awaited_once()
    task.event_sender.flush.assert_awaited_once()
    publish.assert_not_awaited()


async def test_check_drift_notifies_when_resource_starts_drifting(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(monkeypatch, resource_drift_service, result_of(BUCKET))

    await task.check_drift()

    drift = drift_of(task)
    assert drift is not None
    assert (drift.status, drift.known_drift) == (DriftStatus.DRIFTED, [f"{BUCKET}|tags.Owner"])
    publish.assert_awaited_once()
    event = publish.call_args.args[0]
    assert event.event_type == "drift_detected"
    assert (event.entity_type, event.status) == ("resource", "warning")
    assert "1 object(s) would be changed by an apply" in event.message


async def test_check_drift_does_not_renotify_the_same_drift(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(
        monkeypatch, resource_drift_service, result_of(BUCKET), DriftStatus.DRIFTED, [f"{BUCKET}|tags.Owner"]
    )

    await task.check_drift()

    publish.assert_not_awaited()


@pytest.mark.parametrize("previous_status", [DriftStatus.UNKNOWN, DriftStatus.DRIFTED])
async def test_check_drift_does_not_renotify_after_apply_or_failed_check(
    monkeypatch, resource_drift_service, previous_status
):
    # a failed apply marks the result outdated (UNKNOWN) and a failed check keeps it: both keep the known drift
    task, publish = make_drift_task(
        monkeypatch, resource_drift_service, result_of(BUCKET), previous_status, [f"{BUCKET}|tags.Owner"]
    )
    await resource_drift_service.record_failure(task.resource_instance.id, "boom")

    await task.check_drift()

    publish.assert_not_awaited()


async def test_check_drift_notifies_only_new_objects(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(
        monkeypatch, resource_drift_service, result_of(BUCKET, ROLE), DriftStatus.DRIFTED, [f"{BUCKET}|tags.Owner"]
    )

    await task.check_drift()

    publish.assert_awaited_once()
    assert "new drift: 1 object(s)" in publish.call_args.args[0].message


async def test_check_drift_notifies_again_after_in_sync(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(monkeypatch, resource_drift_service, result_of(BUCKET), DriftStatus.IN_SYNC, [])

    await task.check_drift()

    publish.assert_awaited_once()


async def test_drift_notification_counts_all_drifted_objects(monkeypatch, resource_drift_service):
    # the change list is truncated for huge plans, the message uses the total
    task, publish = make_drift_task(monkeypatch, resource_drift_service, result_of(BUCKET, total=250))

    await task.check_drift()

    assert "250 object(s)" in publish.call_args.args[0].message


async def test_a_failed_notification_keeps_the_saved_result(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(monkeypatch, resource_drift_service, result_of(BUCKET))
    publish.side_effect = RuntimeError("outbox is down")

    await task.check_drift()

    drift = drift_of(task)
    assert drift is not None and drift.status == DriftStatus.DRIFTED
    assert drift.consecutive_failures == 0


async def test_check_drift_failure_keeps_the_result_and_known_drift(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(
        monkeypatch, resource_drift_service, None, DriftStatus.DRIFTED, [f"{BUCKET}|tags.Owner"]
    )

    with pytest.raises(ExitWithoutSave):
        await task.check_drift()

    drift = drift_of(task)
    assert drift is not None
    assert (drift.status, drift.known_drift) == (DriftStatus.DRIFTED, [f"{BUCKET}|tags.Owner"])
    assert (drift.consecutive_failures, drift.last_error) == (1, "boom")
    task.session.commit.assert_awaited_once()
    assert task.resource_instance.status == ModelStatus.DONE
    publish.assert_not_awaited()


async def test_check_drift_timeout_is_saved_as_a_failure(monkeypatch, resource_drift_service):
    task, publish = make_drift_task(monkeypatch, resource_drift_service, result_of())

    async def hang(**kwargs):
        await asyncio.sleep(10)

    task.tf_client.drift_check = AsyncMock(side_effect=hang)
    monkeypatch.setattr(
        "application.resources.drift_task.Settings",
        lambda: SimpleNamespace(DRIFT_CHECK_TIMEOUT_SECONDS=0),
    )

    with pytest.raises(ExitWithoutSave, match="timed out"):
        await task.check_drift()

    drift = drift_of(task)
    assert drift is not None
    assert drift.status == DriftStatus.ERROR
    assert "timed out" in (drift.last_error or "")
    cast(AsyncMock, task.clean_workspace).assert_awaited()
    assert task.resource_instance.status == ModelStatus.DONE
    publish.assert_not_awaited()


async def test_a_non_opentofu_workspace_is_a_failed_check(monkeypatch, resource_drift_service):
    task, _ = make_drift_task(monkeypatch, resource_drift_service, result_of())
    task.source_code_instance = Mock(source_code_language="ansible")

    with pytest.raises(ExitWithoutSave):
        await task.check_drift()

    drift = drift_of(task)
    assert drift is not None and drift.status == DriftStatus.ERROR


@pytest.mark.parametrize(
    "changes",
    [
        {"state": ModelState.DESTROYED},
        {"state": ModelState.DESTROY},
        {"status": ModelStatus.QUEUED},
        # approved changes are waiting for an apply: the plan would show them as drift
        {"status": ModelStatus.READY},
        {"abstract": True},
    ],
)
async def test_a_check_the_resource_no_longer_allows_is_skipped(monkeypatch, resource_drift_service, changes):
    # e.g. a destroy queued after the check ran first: the check must not save a result for a destroyed resource
    task, _ = make_drift_task(monkeypatch, resource_drift_service, result_of())
    for key, value in changes.items():
        setattr(task.resource_instance, key, value)

    await task.check_drift()

    assert drift_of(task) is None
    cast(AsyncMock, task.init_workspace).assert_not_awaited()
    cast(AsyncMock, task.tf_client.drift_check).assert_not_awaited()


async def test_failed_drift_check_task_keeps_resource_status(monkeypatch, resource_drift_service):
    # e.g. the worker running the check was lost and the task reaped
    task, publish = make_drift_task(
        monkeypatch, resource_drift_service, None, DriftStatus.DRIFTED, [f"{BUCKET}|tags.Owner"]
    )
    task.change_entity_status = AsyncMock()

    await task.make_failed()

    task.change_entity_status.assert_not_awaited()
    assert task.resource_instance.status == ModelStatus.DONE
    drift = drift_of(task)
    assert drift is not None
    assert (drift.status, drift.consecutive_failures) == (DriftStatus.DRIFTED, 1)
    publish.assert_not_awaited()


async def test_failed_drift_check_of_a_destroyed_resource_records_nothing(resource_drift_service):
    task = make_task(resource_drift_service)
    task.resource_instance.state = ModelState.DESTROYED

    await task.make_failed()

    assert drift_of(task) is None


async def test_failed_drift_check_task_does_not_raise_when_saving_fails():
    task = make_task(Mock(record_failure=AsyncMock(side_effect=RuntimeError("db is gone"))))
    task.change_entity_status = AsyncMock()

    await task.make_failed()

    task.change_entity_status.assert_not_awaited()


@pytest.mark.parametrize("task_class", [ResourceTask, ResourceDriftTask])
async def test_failed_apply_marks_resource_as_error_and_its_drift_as_outdated(task_class):
    # the apply may have changed the infrastructure before it failed
    drift_service = Mock(mark_outdated=AsyncMock())
    task = make_task(drift_service, action=ModelActions.EXECUTE, task_class=task_class)
    task.change_entity_status = AsyncMock()

    await task.make_failed()

    drift_service.mark_outdated.assert_awaited_once_with(task.resource_instance.id)
    task.change_entity_status.assert_awaited_once_with(new_status=ModelStatus.ERROR)


@pytest.mark.parametrize("step", ["create_state", "update_state"])
async def test_successful_apply_sets_the_drift_in_sync(monkeypatch, step):
    drift_service = Mock(mark_applied=AsyncMock())
    task = make_task(drift_service, action=ModelActions.EXECUTE, task_class=ResourceTask)
    for name in (
        "change_entity_status",
        "init_workspace",
        "init_provision_tool",
        "create",
        "update",
        "clean_workspace",
    ):
        monkeypatch.setattr(task, name, AsyncMock())

    await getattr(task, step)()

    # no check is queued after it: the apply set the infrastructure to the configuration
    drift_service.mark_applied.assert_awaited_once_with(task.resource_instance.id)


async def test_failed_apply_marks_resource_as_error_even_when_its_drift_cant_be_saved():
    task = make_task(Mock(mark_outdated=AsyncMock(side_effect=RuntimeError("db is gone"))), action=ModelActions.EXECUTE)
    task.change_entity_status = AsyncMock()

    await task.make_failed()

    task.change_entity_status.assert_awaited_once_with(new_status=ModelStatus.ERROR)


async def _actions(mock_user_dto, monkeypatch, mock_user_permissions, state, status, drift_check_supported=True):
    mock_user_permissions(["write"], monkeypatch, "application.resources.functions.user_entity_permissions")
    return set(
        await get_resource_actions(
            mock_user_dto, uuid4(), status, state, False, drift_check_supported=drift_check_supported
        )
    )


async def test_check_drift_hidden_when_not_supported(mock_user_dto, monkeypatch, mock_user_permissions):
    actions = await _actions(
        mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, ModelStatus.DONE, False
    )
    assert ModelActions.CHECK_DRIFT not in actions


def _resource(language: str | None, abstract: bool = False):
    source_code = SimpleNamespace(source_code_language=language) if language else None
    return SimpleNamespace(abstract=abstract, source_code_version=SimpleNamespace(source_code=source_code))


@pytest.mark.parametrize(
    "resource,expected",
    [
        (_resource("opentofu"), True),
        (_resource("ansible"), False),
        (_resource(None), False),
        (_resource("opentofu", abstract=True), False),
        (SimpleNamespace(abstract=False, source_code_version=None), False),
    ],
)
def test_resource_supports_drift_check(resource, expected):
    assert resource_supports_drift_check(resource) is expected


async def test_check_drift_offered_for_provisioned_resources(mock_user_dto, monkeypatch, mock_user_permissions):
    actions = await _actions(
        mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, ModelStatus.DONE
    )
    assert ModelActions.CHECK_DRIFT in actions
    assert drift_check_blocker(make_resource()) is None


@pytest.mark.parametrize("status", [ModelStatus.READY, ModelStatus.ERROR])
async def test_check_drift_needs_a_resource_without_pending_changes(
    mock_user_dto, monkeypatch, mock_user_permissions, status
):
    # the plan would report the changes waiting for an apply (READY) or left by a failed one (ERROR) as drift
    actions = await _actions(mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, status)
    assert ModelActions.CHECK_DRIFT not in actions
    assert drift_check_blocker(make_resource(status=status)) == DRIFT_NEEDS_DONE


@pytest.mark.parametrize("state", [ModelState.PROVISION, ModelState.DESTROY, ModelState.DESTROYED])
async def test_check_drift_hidden_for_resources_that_are_not_provisioned(
    mock_user_dto, monkeypatch, mock_user_permissions, state
):
    actions = await _actions(mock_user_dto, monkeypatch, mock_user_permissions, state, ModelStatus.READY)
    assert ModelActions.CHECK_DRIFT not in actions
    assert drift_check_blocker(make_resource(state=state)) is not None


def test_validate_drift_action_tells_unsupported_from_wrong_state():
    with pytest.raises(ValueError, match="OpenTofu"):
        validate_drift_action(make_resource(abstract=True))
    with pytest.raises(EntityWrongState):
        validate_drift_action(make_resource(status=ModelStatus.IN_PROGRESS))
    with pytest.raises(EntityWrongState):
        validate_drift_action(make_resource(status=ModelStatus.READY))
    validate_drift_action(make_resource())
