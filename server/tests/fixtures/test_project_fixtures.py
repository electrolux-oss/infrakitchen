from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.projects.model import Project
from application.projects.schema import ProjectResponse
from application.projects.service import ProjectService
from core.constants.model import ModelStatus


@pytest.fixture
def mock_project_crud():
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
def mock_project_service(
    mock_project_crud,
    mock_permission_service,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
):
    return ProjectService(
        crud=mock_project_crud,
        permission_service=mock_permission_service,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def project_response(mocked_user_response):
    return ProjectResponse(
        id=uuid4(),
        name="Test Project",
        description="A test project",
        creator=mocked_user_response,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        labels=["test_label"],
        owners=[],
        dependency_tags=[],
        dependency_config=[],
    )


@pytest.fixture
def mocked_project(mocked_user):
    return Project(
        id=uuid4(),
        name="Test Project",
        description="A test project",
        status=ModelStatus.ENABLED,
        creator=mocked_user,
        created_by=mocked_user.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        workspace_id=None,
        workspace=None,
        owners=[],
        dependency_tags=[],
        dependency_config=[],
        labels=["test_label"],
        configuration={},
    )
