from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from application.templates.api import router
from application.templates.dependencies import get_template_service
from application.templates.schema import TemplateResponse, TemplateUpdate, TemplateCreate, TemplateTreeResponse
from core import UserDTO
import application.templates.api as api_template
from core.base_models import PatchBodyModel

TEMPLATE_ID = "abc123"


class MockTemplateService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_template=None,
        updated_template=None,
        patch_template=None,
        tree=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_template = created_template
        self._updated_template = updated_template
        self._patch_template = patch_template
        self._tree = tree
        self._actions = actions

    async def get_by_id(self, template_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, template: TemplateCreate, requester: UserDTO):
        return self._created_template

    async def update(self, template_id: str, template: TemplateUpdate, requester: UserDTO):
        return self._updated_template

    async def patch(self, template_id, body: PatchBodyModel, requester: UserDTO):
        return self._patch_template

    async def delete(self, template_id: str, requester: UserDTO):
        pass

    async def get_tree(self, template_id: str, direction: str = "children"):
        return self._tree

    async def get_actions(self, template_id: str, requester: UserDTO):
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
    def _override(service: MockTemplateService):
        async def _get_service():
            return service

        app.dependency_overrides[get_template_service] = _get_service

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
    def test_get_by_id_success(self, client, override_service, template_response):
        service = MockTemplateService(return_value=template_response)
        override_service(service)

        response = client.get(f"/templates/{TEMPLATE_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == template_response.name
        assert json_response["template"] == template_response.template

    def test_get_by_id_not_found(self, client, override_service):
        template_id = "invalid_id"
        service = MockTemplateService(return_value=None)
        override_service(service)

        response = client.get(f"/templates/{template_id}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Template not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockTemplateService(total=0, items=[])
        override_service(service)

        response = client.get("/templates")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "templates 0-0/0"

    def test_get_all_with_items(self, client, override_service):
        items = [
            TemplateResponse(id=uuid4(), name="Test Template 1", template="template1"),
            TemplateResponse(id=uuid4(), name="Test Template 2", template="template2"),
        ]
        total = 5
        service = MockTemplateService(total=total, items=items)
        override_service(service)

        response = client.get("/templates")

        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"templates 0-{len(items)}/{total}"


class TestCreate:
    def test_create_forbidden(self, client_without_user):
        template_create = {
            "name": "Test Template 1",
            "description": "New description",
            "template": "template1",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }

        response = client_without_user.post("/templates", json=template_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, template_response):
        template_create = {
            "name": "Test Template 1",
            "description": "New description",
            "template": "template1",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }
        service = MockTemplateService(created_template=template_response)
        override_service(service)

        response = client_with_user.post("/templates", json=template_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == template_response.name
        assert json_response["template"] == template_response.template


class TestUpdate:
    def test_update_forbidden(self, client_with_user, monkeypatch):
        template_update = {
            "name": "Test Template 1",
            "description": "New description",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return False

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.patch(f"/templates/{TEMPLATE_ID}", json=template_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_update_success(self, client_with_user, override_service, monkeypatch, template_response):
        template_update = {
            "name": "Test Template 1",
            "description": "New description",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        service = MockTemplateService(updated_template=template_response)
        override_service(service)

        response = client_with_user.patch(f"/templates/{TEMPLATE_ID}", json=template_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == template_response.name
        assert json_response["template"] == template_response.template


class TestPatchAction:
    def test_patch_action_forbidden(self, client_with_user, monkeypatch):
        template_patch = {
            "action": "create",
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return False

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.patch(f"/templates/{TEMPLATE_ID}/actions", json=template_patch)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_patch_action_value_error(self, client_with_user, monkeypatch):
        template_patch = {
            "action": "unknown",
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.patch(f"/templates/{TEMPLATE_ID}/actions", json=template_patch)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_action_success(self, client_with_user, override_service, monkeypatch, template_response):
        template_patch = {
            "action": "create",
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        service = MockTemplateService(patch_template=template_response)
        override_service(service)

        response = client_with_user.patch(f"/templates/{TEMPLATE_ID}/actions", json=template_patch)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == template_response.name
        assert json_response["template"] == template_response.template


class TestDelete:
    def test_delete_forbidden(self, client_with_user, monkeypatch):
        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return False

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.delete(f"/templates/{TEMPLATE_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_delete_success(self, client_with_user, override_service, monkeypatch):
        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_template, "user_has_access_to_resource", mock_user_has_access_to_resource)

        service = MockTemplateService()
        override_service(service)

        response = client_with_user.delete(f"/templates/{TEMPLATE_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockTemplateService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/templates/{TEMPLATE_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockTemplateService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/templates/{TEMPLATE_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []


class TestTree:
    def test_get_tree_success(self, client_with_user, override_service):
        template_tree_response = TemplateTreeResponse(id=uuid4(), name="tree1", status="", children=[])
        service = MockTemplateService(tree=template_tree_response)
        override_service(service)

        response = client_with_user.get(f"/templates/{TEMPLATE_ID}/tree/children")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == "tree1"
