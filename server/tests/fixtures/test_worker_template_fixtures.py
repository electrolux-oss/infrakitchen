from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.worker_templates.crud import WorkerTemplateCRUD
from application.worker_templates.model import WorkerTemplate
from application.providers.worker_providers.kubernetes_default_manifest import DEFAULT_POD_MANIFEST
from application.worker_templates.service import WorkerTemplateService
from core.workers.service import WorkerService


@pytest.fixture
def mock_worker_template_crud():
    crud = Mock(spec=WorkerTemplateCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock(return_value=0)
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.refresh = AsyncMock()
    crud.lock_default = AsyncMock()
    crud.get_default = AsyncMock(return_value=None)
    crud.set_default = AsyncMock()
    crud.get_dependencies = AsyncMock(return_value=[])
    crud.retarget_queued_tasks = AsyncMock(return_value=0)
    crud.get_pool_infos = AsyncMock(return_value=[])
    return crud


@pytest.fixture
def mock_template_worker_service():
    service = Mock(spec=WorkerService)
    service.get_by_hosts = AsyncMock(return_value=[])
    service.delete_by_hosts = AsyncMock(return_value=0)
    return service


@pytest.fixture
def stub_worker_template_service():
    """A fully mocked service, for services that only validate a selected template."""
    service = Mock(spec=WorkerTemplateService)
    service.validate_selectable = AsyncMock()
    service.retarget_tasks = AsyncMock(return_value=0)
    return service


@pytest.fixture
def mock_worker_template_service(
    mock_worker_template_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_template_worker_service,
):
    return WorkerTemplateService(
        crud=mock_worker_template_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        worker_service=mock_template_worker_service,
    )


@pytest.fixture
def mocked_worker_template(mocked_user):
    return WorkerTemplate(
        id=uuid4(),
        name="default",
        description="Default workers",
        provider="kubernetes",
        configuration={"provider": "kubernetes", "pod_manifest": DEFAULT_POD_MANIFEST, "namespace": "ik"},
        max_workers=3,
        idle_timeout_seconds=300,
        is_default=False,
        last_error=None,
        spawn_failures=0,
        spawn_blocked_until=None,
        spawn_failed_at=None,
        labels=[],
        status="enabled",
        revision_number=1,
        creator=mocked_user,
        created_by=mocked_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
