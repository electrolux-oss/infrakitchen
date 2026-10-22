from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.worker_templates.crud import WorkerTemplateCRUD
from application.worker_templates.model import WorkerTemplate
from application.worker_templates.providers.kubernetes_default_manifest import DEFAULT_POD_MANIFEST
from application.worker_templates.service import WorkerTemplateService


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
    return crud


@pytest.fixture
def mock_worker_template_service(
    mock_worker_template_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
):
    return WorkerTemplateService(
        crud=mock_worker_template_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
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
        priority=0,
        last_error=None,
        labels=[],
        status="enabled",
        revision_number=1,
        creator=mocked_user,
        created_by=mocked_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
