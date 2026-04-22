from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from application.workflows.api import router
from application.workflows.dependencies import get_workflow_service
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions

WORKFLOW_ID = str(uuid4())


class MockWorkflowService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        patch_workflow=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._patch_workflow = patch_workflow
        self._actions = actions

    async def get_by_id(self, workflow_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def patch_action(self, workflow_id: str, body: PatchBodyModel, requester: UserDTO):
        return self._patch_workflow

    async def delete(self, workflow_id: str, requester: UserDTO):
        pass

    async def get_workflow_actions(self, workflow_id: str, requester: str | UUID):
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
    def _override(service: MockWorkflowService):
        async def _get_service():
            return service

        app.dependency_overrides[get_workflow_service] = _get_service

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
    def test_get_by_id_success(self, client, override_service, workflow_response):
        service = MockWorkflowService(return_value=workflow_response)
        override_service(service)

        response = client.get(f"/workflows/{workflow_response.id}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(workflow_response.id)
        assert json_response["status"] == workflow_response.status
        assert json_response["_entity_name"] == "workflow"
        assert json_response["creator"]["id"] == str(workflow_response.creator.id)

    def test_get_by_id_with_steps(self, client, override_service, workflow_response):
        service = MockWorkflowService(return_value=workflow_response)
        override_service(service)

        response = client.get(f"/workflows/{workflow_response.id}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response["steps"]) == 1
        assert json_response["steps"][0]["id"] == str(workflow_response.steps[0].id)

    def test_get_by_id_not_found(self, client, override_service):
        service = MockWorkflowService(return_value=None)
        override_service(service)

        response = client.get(f"/workflows/{WORKFLOW_ID}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Execution not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockWorkflowService(total=0, items=[])
        override_service(service)

        response = client.get("/workflows")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "workflows 0-0/0"

    def test_get_all_with_items(self, client, override_service, workflow_response):
        workflow2 = workflow_response.model_copy(deep=True)
        workflow2.id = uuid4()
        items = [workflow_response, workflow2]
        total = 5
        service = MockWorkflowService(total=total, items=items)
        override_service(service)

        response = client.get("/workflows")

        assert response.status_code == HTTPStatus.OK
        assert len(response.json()) == 2
        assert response.headers["Content-Range"] == f"workflows 0-{len(items)}/{total}"

    def test_get_all_returns_entity_name(self, client, override_service, workflow_response):
        service = MockWorkflowService(total=1, items=[workflow_response])
        override_service(service)

        response = client.get("/workflows")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0]["_entity_name"] == "workflow"


class TestPatchAction:
    def test_patch_action_forbidden_no_user(self, client_without_user):
        patch_body = {"action": "execute"}

        response = client_without_user.patch(f"/workflows/{WORKFLOW_ID}/actions", json=patch_body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_patch_action_invalid_action(self, client_with_user):
        patch_body = {"action": "unknown"}

        response = client_with_user.patch(f"/workflows/{WORKFLOW_ID}/actions", json=patch_body)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_action_execute_success(self, client_with_user, override_service, workflow_response):
        service = MockWorkflowService(patch_workflow=workflow_response)
        override_service(service)

        patch_body = {"action": "execute"}
        response = client_with_user.patch(f"/workflows/{WORKFLOW_ID}/actions", json=patch_body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(workflow_response.id)
        assert json_response["status"] == workflow_response.status


class TestGetActions:
    def test_get_actions_forbidden_no_user(self, client_without_user):
        response = client_without_user.get(f"/workflows/{WORKFLOW_ID}/actions")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_get_actions_success(self, client_with_user, override_service):
        service = MockWorkflowService(actions=[ModelActions.EXECUTE, ModelActions.DELETE])
        override_service(service)

        response = client_with_user.get(f"/workflows/{WORKFLOW_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert ModelActions.EXECUTE in json_response
        assert ModelActions.DELETE in json_response

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockWorkflowService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/workflows/{WORKFLOW_ID}/actions")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []


class TestDelete:
    def test_delete_forbidden_no_user(self, client_without_user):
        response = client_without_user.delete(f"/workflows/{WORKFLOW_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_delete_success(self, client_with_user, override_service):
        service = MockWorkflowService()
        override_service(service)

        response = client_with_user.delete(f"/workflows/{WORKFLOW_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT
