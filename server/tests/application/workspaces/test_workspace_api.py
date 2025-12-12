from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from application.workspaces.api import router
from application.workspaces.dependencies import get_workspace_service
from application.workspaces.schema import WorkspaceUpdate, WorkspaceCreate
from core import UserDTO
from core.constants.model import ModelActions

WORKSPACE_ID = "abc123"


class MockWorkspaceService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_workspace=None,
        updated_workspace=None,
        patch_workspace=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_workspace = created_workspace
        self._updated_workspace = updated_workspace
        self._patch_workspace = patch_workspace
        self._actions = actions

    async def get_by_id(self, workspace_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, workspace: WorkspaceCreate, requester: UserDTO):
        return self._created_workspace

    async def update(self, workspace_id: str, workspace: WorkspaceUpdate, requester: UserDTO):
        return self._updated_workspace

    async def delete(self, workspace_id: str):
        pass

    async def get_actions(self, workspace_id: str, requester: str | UUID):
        return self._actions


@pytest.fixture(autouse=True)
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app)


@pytest.fixture
def override_service(app):
    def _override(service: MockWorkspaceService):
        async def _get_service():
            return service

        app.dependency_overrides[get_workspace_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = "user123"

    user = MockUser()

    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = user
        return await call_next(request)

    return TestClient(app)


@pytest.fixture
def client_without_user(app):
    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = None
        return await call_next(request)

    return TestClient(app)


class TestGetById:
    def test_get_by_id_success(self, client, override_service, workspace_response):
        service = MockWorkspaceService(return_value=workspace_response)
        override_service(service)

        response = client.get(f"/workspaces/{WORKSPACE_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == workspace_response.name
        assert json_response["integration"]["id"] == str(workspace_response.integration.id)

    def test_get_by_id_not_found(self, client, override_service):
        workspace_id = "invalid_id"
        service = MockWorkspaceService(return_value=None)
        override_service(service)

        response = client.get(f"/workspaces/{workspace_id}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Workspace not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockWorkspaceService(total=0, items=[])
        override_service(service)

        response = client.get("/workspaces")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "workspaces 0-0/0"

    def test_get_all_with_items(self, client, override_service, workspace_response):
        workspace1 = workspace_response
        workspace2 = workspace_response.model_copy(deep=True)
        workspace2.id = uuid4()
        items = [workspace1, workspace2]
        total = 5
        service = MockWorkspaceService(total=total, items=items)
        override_service(service)

        response = client.get("/workspaces")

        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"workspaces 0-{len(items)}/{total}"


class TestCreate:
    def test_create_forbidden(self, client_without_user):
        workspace_create = {
            "description": "New description",
            "workspace_provider": "github",
            "integration_id": str(uuid4()),
            "configuration": {
                "id": 123456,
                "name": "TestWorkspace",
                "html_url": "http://example.com",
                "git_url": "http://git.example.com",
                "ssh_url": "ssh://example.com",
                "clone_url": "http://clone.example.com",
                "url": "http://url.example.com",
                "created_at": "2023-10-01T00:00:00Z",
                "updated_at": "2023-10-01T01:00:00Z",
                "pushed_at": None,
                "description": "Test description",
                "workspace_provider": "github",
                "default_branch": "main",
                "owner": {
                    "login": "test_owner",
                },
            },
        }

        response = client_without_user.post("/workspaces", json=workspace_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, workspace_response):
        workspace_create = {
            "description": "New description",
            "workspace_provider": "github",
            "integration_id": str(uuid4()),
            "configuration": {
                "id": 123456,
                "name": "TestWorkspace",
                "html_url": "http://example.com",
                "git_url": "http://git.example.com",
                "ssh_url": "ssh://example.com",
                "clone_url": "http://clone.example.com",
                "url": "http://url.example.com",
                "created_at": "2023-10-01T00:00:00Z",
                "updated_at": "2023-10-01T01:00:00Z",
                "pushed_at": None,
                "description": "Test description",
                "workspace_provider": "github",
                "default_branch": "main",
                "owner": {
                    "login": "test_owner",
                },
            },
        }
        service = MockWorkspaceService(created_workspace=workspace_response)
        override_service(service)

        response = client_with_user.post("/workspaces", json=workspace_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == workspace_response.name
        assert json_response["workspace_provider"] == workspace_response.workspace_provider


class TestUpdate:
    def test_update_forbidden(self, client_with_user, override_service):
        workspace_update = {
            "name": "Test Workspace Updated",
            "description": "New description",
            "labels": ["label1", "label2"],
        }

        service = MockWorkspaceService(actions=[])
        override_service(service)

        response = client_with_user.put(f"/workspaces/{WORKSPACE_ID}", json=workspace_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}

    def test_update_success(self, client_with_user, override_service, workspace_response):
        workspace_update = {
            "name": "Test Workspace Updated",
            "description": "New description",
            "labels": ["label1", "label2"],
        }

        service = MockWorkspaceService(updated_workspace=workspace_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.put(f"/workspaces/{WORKSPACE_ID}", json=workspace_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == workspace_response.name
        assert json_response["workspace_provider"] == workspace_response.workspace_provider


class TestDelete:
    def test_delete_forbidden(self, client_with_user, override_service):
        service = MockWorkspaceService(actions=[])
        override_service(service)

        response = client_with_user.delete(f"/workspaces/{WORKSPACE_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}

    def test_delete_success(self, client_with_user, override_service):
        service = MockWorkspaceService(actions=[ModelActions.DELETE])
        override_service(service)

        response = client_with_user.delete(f"/workspaces/{WORKSPACE_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestGetActions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockWorkspaceService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/workspaces/{WORKSPACE_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockWorkspaceService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/workspaces/{WORKSPACE_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []
