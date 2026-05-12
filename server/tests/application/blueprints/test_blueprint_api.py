from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from application.blueprints.api import router
from application.blueprints.dependencies import get_blueprint_service
from application.blueprints.schema import BlueprintCreate, BlueprintUpdate
from application.workflows.schema import WorkflowRequest
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions

BLUEPRINT_ID = str(uuid4())


class MockBlueprintService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_blueprint=None,
        updated_blueprint=None,
        patch_blueprint=None,
        actions=None,
        workflow_result=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_blueprint = created_blueprint
        self._updated_blueprint = updated_blueprint
        self._patch_blueprint = patch_blueprint
        self._actions = actions
        self._workflow_result = workflow_result

    async def get_by_id(self, blueprint_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, blueprint: BlueprintCreate, requester: UserDTO):
        return self._created_blueprint

    async def update(self, blueprint_id: str, blueprint: BlueprintUpdate, requester: UserDTO):
        return self._updated_blueprint

    async def patch(self, blueprint_id: str, body: PatchBodyModel, requester: UserDTO):
        return self._patch_blueprint

    async def delete(self, blueprint_id: str, requester: UserDTO):
        pass

    async def get_actions(self, blueprint_id: str, requester: str | UUID):
        return self._actions

    async def create_workflow(self, blueprint_id: str, request: WorkflowRequest, requester: UserDTO):
        return self._workflow_result


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
    def _override(service: MockBlueprintService):
        async def _get_service():
            return service

        app.dependency_overrides[get_blueprint_service] = _get_service

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
    def test_get_by_id_success(self, client, override_service, blueprint_response):
        service = MockBlueprintService(return_value=blueprint_response)
        override_service(service)

        response = client.get(f"/blueprints/{blueprint_response.id}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(blueprint_response.id)
        assert json_response["name"] == blueprint_response.name
        assert json_response["_entity_name"] == "blueprint"

    def test_get_by_id_not_found(self, client, override_service):
        service = MockBlueprintService(return_value=None)
        override_service(service)

        response = client.get(f"/blueprints/{BLUEPRINT_ID}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Blueprint not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockBlueprintService(total=0, items=[])
        override_service(service)

        response = client.get("/blueprints")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "blueprints 0-0/0"

    def test_get_all_with_items(self, client, override_service, blueprint_response):
        bp2 = blueprint_response.model_copy(deep=True)
        bp2.id = uuid4()
        items = [blueprint_response, bp2]
        total = 5
        service = MockBlueprintService(total=total, items=items)
        override_service(service)

        response = client.get("/blueprints")

        assert response.status_code == HTTPStatus.OK
        assert len(response.json()) == 2
        assert response.headers["Content-Range"] == f"blueprints 0-{len(items)}/{total}"

    def test_get_all_returns_entity_name(self, client, override_service, blueprint_response):
        service = MockBlueprintService(total=1, items=[blueprint_response])
        override_service(service)

        response = client.get("/blueprints")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0]["_entity_name"] == "blueprint"


class TestCreate:
    def test_create_forbidden(self, client_without_user):
        body = {
            "name": "New Blueprint",
            "template_ids": [str(uuid4())],
        }

        response = client_without_user.post("/blueprints", json=body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, blueprint_response):
        body = {
            "name": "New Blueprint",
            "template_ids": [str(uuid4())],
        }

        service = MockBlueprintService(created_blueprint=blueprint_response)
        override_service(service)

        response = client_with_user.post("/blueprints", json=body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == blueprint_response.name


class TestUpdate:
    def test_update_success(self, client_with_user, override_service, blueprint_response):
        body = {
            "name": "Updated Blueprint",
            "description": "Updated description",
        }

        service = MockBlueprintService(updated_blueprint=blueprint_response)
        override_service(service)

        response = client_with_user.patch(f"/blueprints/{BLUEPRINT_ID}", json=body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == blueprint_response.name


class TestPatchAction:
    def test_patch_action_invalid_action(self, client_with_user):
        body = {"action": "unknown"}

        response = client_with_user.patch(f"/blueprints/{BLUEPRINT_ID}/actions", json=body)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_action_forbidden(self, client_with_user, override_service):
        body = {"action": "disable"}
        service = MockBlueprintService(actions=[])
        override_service(service)

        response = client_with_user.patch(f"/blueprints/{BLUEPRINT_ID}/actions", json=body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action disable"}

    def test_patch_action_success(self, client_with_user, override_service, blueprint_response):
        body = {"action": "disable"}
        service = MockBlueprintService(
            patch_blueprint=blueprint_response,
            actions=[ModelActions.DISABLE],
        )
        override_service(service)

        response = client_with_user.patch(f"/blueprints/{BLUEPRINT_ID}/actions", json=body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(blueprint_response.id)


class TestGetActions:
    def test_get_actions_forbidden_no_user(self, client_without_user):
        response = client_without_user.get(f"/blueprints/{BLUEPRINT_ID}/actions")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_get_actions_success(self, client_with_user, override_service):
        service = MockBlueprintService(actions=[ModelActions.EDIT, ModelActions.DISABLE])
        override_service(service)

        response = client_with_user.get(f"/blueprints/{BLUEPRINT_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert ModelActions.EDIT in json_response
        assert ModelActions.DISABLE in json_response

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockBlueprintService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/blueprints/{BLUEPRINT_ID}/actions")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []


class TestDelete:
    def test_delete_forbidden(self, client_with_user, override_service):
        service = MockBlueprintService(actions=[])
        override_service(service)

        response = client_with_user.delete(f"/blueprints/{BLUEPRINT_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": f"Access denied for action {ModelActions.DELETE.value}"}

    def test_delete_success(self, client_with_user, override_service):
        service = MockBlueprintService(actions=[ModelActions.DELETE])
        override_service(service)

        response = client_with_user.delete(f"/blueprints/{BLUEPRINT_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestExecuteBlueprint:
    def test_execute_forbidden_no_user(self, client_without_user):
        body = {}

        response = client_without_user.post(f"/blueprints/{BLUEPRINT_ID}/create_workflow", json=body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_execute_success(self, client_with_user, override_service, workflow_response):
        body = {}
        service = MockBlueprintService(workflow_result=workflow_response)
        override_service(service)

        response = client_with_user.post(f"/blueprints/{BLUEPRINT_ID}/create_workflow", json=body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["id"] == str(workflow_response.id)
        assert json_response["status"] == workflow_response.status
        assert json_response["_entity_name"] == "workflow"
