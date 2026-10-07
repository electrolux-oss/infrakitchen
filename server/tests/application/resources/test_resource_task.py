from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

from application.resources.task import ResourceTask
from core.constants.model import ModelActions


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
