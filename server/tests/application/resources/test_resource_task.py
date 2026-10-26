from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from application.resources.task import ResourceTask
from core.constants.model import ModelActions, ModelState
from core.errors import ExitWithoutSave


def make_task(integration_ids, storage) -> tuple[ResourceTask, AsyncMock]:
    resource = Mock(integration_ids=integration_ids, storage=storage)
    task = ResourceTask(
        session=Mock(),
        crud_resource=Mock(),
        resource_service=Mock(),
        resource_instance=resource,
        source_code_version_service=Mock(),
        task_service=Mock(),
        logger=Mock(),
        secret_manager=Mock(),
        user=Mock(),
        event_sender=Mock(),
        action=ModelActions.EXECUTE,
        workspace_root="/tmp/ik-test",
    )
    get_cloud_credentials = AsyncMock()
    task.cloud_api_manager = Mock(get_cloud_credentials=get_cloud_credentials)
    return task, get_cloud_credentials


async def test_storage_integration_used_without_resource_integrations(mocked_integration):
    storage = SimpleNamespace(name="state", integration=mocked_integration)
    task, get_cloud_credentials = make_task(integration_ids=[], storage=storage)

    await task.authenticate_storage_backend()

    get_cloud_credentials.assert_awaited_once()
    integration = get_cloud_credentials.call_args.args[0]
    assert integration.id == mocked_integration.id


async def test_storage_integration_skipped_when_resource_has_same_provider(mocked_integration):
    storage = SimpleNamespace(name="state", integration=mocked_integration)
    task, get_cloud_credentials = make_task(integration_ids=[mocked_integration], storage=storage)

    await task.authenticate_storage_backend()

    get_cloud_credentials.assert_not_awaited()


async def test_storage_integration_used_when_resource_has_other_provider(mocked_integration):
    storage = SimpleNamespace(name="state", integration=mocked_integration)
    gcp_integration = SimpleNamespace(integration_type="cloud", integration_provider="gcp")
    task, get_cloud_credentials = make_task(integration_ids=[gcp_integration], storage=storage)

    await task.authenticate_storage_backend()

    get_cloud_credentials.assert_awaited_once()


async def test_no_storage(mocked_integration):
    task, get_cloud_credentials = make_task(integration_ids=[], storage=None)

    await task.authenticate_storage_backend()

    get_cloud_credentials.assert_not_awaited()


# Dry run reports its result to the workflow that started it


def make_dry_run_task(monkeypatch, trace_id: str | None, fail: bool = False) -> tuple[ResourceTask, AsyncMock]:
    task, _ = make_task(integration_ids=[], storage=None)
    task.action = ModelActions.DRYRUN
    task.logger = Mock(trace_id=trace_id)
    task.init_workspace = AsyncMock()
    task.init_provision_tool = AsyncMock()
    task.clean_workspace = AsyncMock()
    task.workspace_path = "/tmp/ik-test"
    task.source_code_instance = Mock(source_code_language="opentofu")
    task.tf_client = Mock(init=AsyncMock(), dry_run=AsyncMock(side_effect=RuntimeError("boom") if fail else None))
    task.resource_instance.state = ModelState.PROVISIONED

    send_task = AsyncMock()
    monkeypatch.setattr(
        "application.resources.task.EventSender",
        Mock(return_value=Mock(send_task=send_task, flush=AsyncMock())),
    )
    return task, send_task


async def test_dry_run_reports_done_to_workflow(monkeypatch):
    task, send_task = make_dry_run_task(monkeypatch, trace_id="wf-1")

    await task.dry_run()

    send_task.assert_awaited_once()
    assert send_task.call_args.kwargs["entity_id"] == "wf-1"
    assert send_task.call_args.kwargs["extra_metadata"]["step_status"] == "done"


async def test_dry_run_reports_error_to_workflow(monkeypatch):
    task, send_task = make_dry_run_task(monkeypatch, trace_id="wf-1", fail=True)

    with pytest.raises(ExitWithoutSave):
        await task.dry_run()

    send_task.assert_awaited_once()
    assert send_task.call_args.kwargs["extra_metadata"]["step_status"] == "error"


async def test_dry_run_without_workflow_sends_no_callback(monkeypatch):
    task, send_task = make_dry_run_task(monkeypatch, trace_id=None)

    await task.dry_run()

    send_task.assert_not_called()
