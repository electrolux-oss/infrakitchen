from pydantic import HttpUrl
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.workspaces.crud import WorkspaceCRUD
from application.workspaces.model import Workspace
from application.workspaces.schema import WorkspaceMeta, WorkspaceResponse
from application.workspaces.service import WorkspaceService


@pytest.fixture
def mock_workspace_crud():
    crud = Mock(spec=WorkspaceCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_dependencies = AsyncMock()
    return crud


@pytest.fixture
def mock_workspace_service(
    mock_workspace_crud,
    mock_event_sender,
    mock_audit_log_handler,
    mock_log_service,
    mock_task_entity_service,
):
    return WorkspaceService(
        crud=mock_workspace_crud,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        log_service=mock_log_service,
        task_service=mock_task_entity_service,
    )


@pytest.fixture
def workspace_response(mocked_user_response, mocked_integration_response):
    config = WorkspaceMeta(
        default_branch="main",
        name="Test-Workspace",
        url=HttpUrl("http://example.com"),
        description="Test description",
        ssh_url="git://example.com",
        https_url=HttpUrl("http://example.com/test-workspace"),
        organization="test-org",
    )
    return WorkspaceResponse(
        id=uuid4(),
        name="TestWorkspace",
        labels=["label1", "label2"],
        creator=mocked_user_response,
        integration=mocked_integration_response,
        workspace_provider="github",
        configuration=config,
    )


@pytest.fixture
def workspace():
    return Workspace(
        id=uuid4(),
        name="TestWorkspace",
        workspace_provider="github",
        configuration={
            "default_branch": "main",
            "name": "Test-Workspace",
            "url": "http://example.com",
            "ssh_url": "git://example.com",
            "https_url": "http://example.com/test-workspace",
            "organization": "test-org",
        },
        description="Test description",
        labels=["label1", "label2"],
    )
