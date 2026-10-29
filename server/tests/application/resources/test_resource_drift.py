from types import SimpleNamespace
from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.resource_drifts.model import ResourceDrift
from application.resources.functions import get_resource_actions
from application.resources.task import ResourceTask
from core.constants.model import DriftStatus, EventType, ModelActions, ModelState, ModelStatus
from core.errors import ExitWithoutSave


def make_task() -> ResourceTask:
    return ResourceTask(
        session=Mock(),
        crud_resource=Mock(),
        resource_service=Mock(),
        resource_instance=Mock(integration_ids=[], storage=None),
        source_code_version_service=Mock(),
        task_service=Mock(),
        logger=Mock(),
        secret_manager=Mock(),
        user=Mock(),
        event_sender=Mock(),
        action=ModelActions.CHECK_DRIFT,
        workspace_root="/tmp/ik-test",
    )


def drift_of(task: ResourceTask) -> ResourceDrift:
    """The drift row that the task upserted."""
    return cast(Any, task.session).row_holder.row


def make_drift_task(
    monkeypatch, drift_result: dict[str, Any] | None, previous_status: DriftStatus = DriftStatus.UNKNOWN
) -> tuple[ResourceTask, AsyncMock, AsyncMock]:
    task = make_task()
    row_holder = SimpleNamespace(row=None)
    task.logger = Mock(save_log=AsyncMock())
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
    # the first lookup reads the previous status, the second one the row that is upserted
    existing = ResourceDrift(status=previous_status) if previous_status != DriftStatus.UNKNOWN else None
    row_holder.row = existing

    async def scalar(statement):
        if len(statement.column_descriptions) == 1:
            return existing.status if existing else None
        return existing

    def add(row):
        row_holder.row = row

    task.session = Mock(commit=AsyncMock(), refresh=AsyncMock(), scalar=scalar, add=add, row_holder=row_holder)
    task.crud_resource = Mock()
    send_event = AsyncMock()
    task.event_sender = Mock(send_event=send_event, flush=AsyncMock())
    task.resource_instance.state = ModelState.PROVISIONED
    task.resource_instance.status = ModelStatus.DONE
    task.resource_instance.name = "orders-db"
    task.resource_instance.id = uuid4()

    response = Mock(model_validate=Mock(return_value=Mock(model_dump=Mock(return_value={}))))
    monkeypatch.setattr("application.resources.task.ResourceResponse", response)
    monkeypatch.setattr("application.resources.task.ResourceDriftEvent", Mock(model_validate=Mock()))
    monkeypatch.setattr("application.resources.task.ResourceDriftResponse", Mock(model_validate=Mock()))
    publish = AsyncMock()
    monkeypatch.setattr("application.resources.task.publish_notification_event", publish)
    return task, publish, send_event


async def test_check_drift_in_sync_saves_status_without_notification(monkeypatch):
    task, publish, send_event = make_drift_task(monkeypatch, {"drifted": False, "resources": []})

    await task.check_drift()

    assert drift_of(task).status == DriftStatus.IN_SYNC
    assert drift_of(task).checked_at is not None
    assert drift_of(task).summary == {"drifted": False, "resources": []}
    # the provisioning state and status are not touched by a drift check
    assert task.resource_instance.state == ModelState.PROVISIONED
    assert task.resource_instance.status == ModelStatus.DONE
    publish.assert_not_awaited()
    send_event.assert_awaited_once()
    assert send_event.call_args.args[1] == EventType.UPDATE


async def test_check_drift_notifies_when_resource_starts_drifting(monkeypatch):
    task, publish, _ = make_drift_task(monkeypatch, {"drifted": True, "resources": ["aws_s3_bucket.this"]})

    await task.check_drift()

    assert drift_of(task).status == DriftStatus.DRIFTED
    publish.assert_awaited_once()
    event = publish.call_args.args[0]
    assert event.event_type == EventType.DRIFT_DETECTED
    assert event.entity_type == "resource"
    assert event.status == "warning"


async def test_check_drift_does_not_renotify_already_drifted_resource(monkeypatch):
    task, publish, _ = make_drift_task(
        monkeypatch, {"drifted": True, "resources": ["aws_s3_bucket.this"]}, previous_status=DriftStatus.DRIFTED
    )

    await task.check_drift()

    assert drift_of(task).status == DriftStatus.DRIFTED
    publish.assert_not_awaited()


async def test_check_drift_failure_is_saved_as_error(monkeypatch):
    task, publish, _ = make_drift_task(monkeypatch, None)

    with pytest.raises(ExitWithoutSave):
        await task.check_drift()

    assert drift_of(task).status == DriftStatus.ERROR
    assert drift_of(task).summary == {"error": "boom"}
    assert task.resource_instance.status == ModelStatus.DONE
    publish.assert_not_awaited()


async def test_check_drift_rejects_non_opentofu_code(monkeypatch):
    task, _, _ = make_drift_task(monkeypatch, {"drifted": False, "resources": []})
    task.source_code_instance = Mock(source_code_language="ansible")

    with pytest.raises(ExitWithoutSave):
        await task.check_drift()

    assert drift_of(task).status == DriftStatus.ERROR


async def _actions(mock_user_dto, monkeypatch, mock_user_permissions, state, status):
    mock_user_permissions(["write"], monkeypatch, "application.resources.functions.user_entity_permissions")
    return set(await get_resource_actions(mock_user_dto, uuid4(), status, state, False))


@pytest.mark.parametrize("status", [ModelStatus.DONE, ModelStatus.READY, ModelStatus.ERROR])
async def test_check_drift_offered_for_provisioned_resources(mock_user_dto, monkeypatch, mock_user_permissions, status):
    actions = await _actions(mock_user_dto, monkeypatch, mock_user_permissions, ModelState.PROVISIONED, status)
    assert ModelActions.CHECK_DRIFT in actions


@pytest.mark.parametrize("state", [ModelState.PROVISION, ModelState.DESTROY, ModelState.DESTROYED])
async def test_check_drift_hidden_for_resources_that_are_not_provisioned(
    mock_user_dto, monkeypatch, mock_user_permissions, state
):
    actions = await _actions(mock_user_dto, monkeypatch, mock_user_permissions, state, ModelStatus.READY)
    assert ModelActions.CHECK_DRIFT not in actions
