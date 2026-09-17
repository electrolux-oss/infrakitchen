from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.services.model import Service
from application.services.schema import ServiceResponse
from application.services.service import ServiceService


@pytest.fixture
def mock_service_crud():
    crud = Mock()
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.refresh = AsyncMock()
    crud.session = Mock()
    crud.session.execute = AsyncMock()
    return crud


@pytest.fixture
def mock_service_service(
    mock_service_crud,
    mock_permission_service,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_subscription_service,
):
    return ServiceService(
        crud=mock_service_crud,
        permission_service=mock_permission_service,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        subscription_service=mock_subscription_service,
    )


@pytest.fixture
def service_response(mocked_user_response, project_response):
    return ServiceResponse(
        id=uuid4(),
        name="test-service",
        display_name="Test Service",
        description="A test service",
        project_id=project_response.id,
        creator=mocked_user_response,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        labels=["test_label"],
        owners=[],
    )


@pytest.fixture
def mocked_service(mocked_user, mocked_project):
    return Service(
        id=uuid4(),
        name="test-service",
        display_name="Test Service",
        description="A test service",
        project_id=mocked_project.id,
        project=mocked_project,
        creator=mocked_user,
        created_by=mocked_user.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        owners=[],
        labels=["test_label"],
    )
