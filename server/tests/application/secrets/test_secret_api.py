from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from application.secrets.api import router
from application.secrets.dependencies import get_secret_service
from application.secrets.schema import SecretUpdate, SecretCreate
from core import UserDTO
import application.secrets.api as api_secret
from core.base_models import PatchBodyModel

secret_ID = "abc123"


class MockSecretService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_secret=None,
        updated_secret=None,
        patch_secret=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_secret = created_secret
        self._updated_secret = updated_secret
        self._patch_secret = patch_secret
        self._actions = actions

    async def get_by_id(self, secret_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, secret: SecretCreate, requester: UserDTO):
        return self._created_secret

    async def update(self, secret_id: str, secret: SecretUpdate, requester: UserDTO):
        return self._updated_secret

    async def patch_action(self, secret_id, body: PatchBodyModel, requester: UserDTO):
        return self._patch_secret

    async def delete(self, secret_id: str, requester: UserDTO):
        pass

    async def get_actions(self, secret_id: str, requester: str | UUID):
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
    def _override(service: MockSecretService):
        async def _get_service():
            return service

        app.dependency_overrides[get_secret_service] = _get_service

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
    def test_get_by_id_success(self, client, override_service, mocked_secret_response):
        service = MockSecretService(return_value=mocked_secret_response)
        override_service(service)

        response = client.get(f"/secrets/{secret_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == mocked_secret_response.name
        assert json_response["integration"]["id"] == str(mocked_secret_response.integration.id)

    def test_get_by_id_not_found(self, client, override_service):
        secret_id = "invalid_id"
        service = MockSecretService(return_value=None)
        override_service(service)

        response = client.get(f"/secrets/{secret_id}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Secret not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockSecretService(total=0, items=[])
        override_service(service)

        response = client.get("/secrets")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "secrets 0-0/0"

    def test_get_all_with_items(self, client, override_service, mocked_secret_response):
        secret1 = mocked_secret_response
        secret2 = mocked_secret_response.model_copy(deep=True)
        secret2.id = uuid4()
        items = [secret1, secret2]
        total = 5
        service = MockSecretService(total=total, items=items)
        override_service(service)

        response = client.get("/secrets")

        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"secrets 0-{len(items)}/{total}"


class TestCreate:
    def test_create_forbidden(self, client_without_user):
        secret_create = {
            "name": "Test Secret 1",
            "description": "New description",
            "secret_type": "tofu",
            "secret_provider": "aws",
            "integration_id": str(uuid4()),
            "configuration": {
                "name": "test-bucket",
                "aws_region": "us-west-2",
                "secret_provider": "aws",
            },
        }

        response = client_without_user.post("/secrets", json=secret_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, mocked_secret_response):
        secret_create = {
            "name": "Test Secret 1",
            "description": "New description",
            "secret_type": "tofu",
            "secret_provider": "aws",
            "integration_id": str(uuid4()),
            "configuration": {
                "name": "test-bucket",
                "aws_region": "us-west-2",
                "secret_provider": "aws",
            },
        }

        service = MockSecretService(created_secret=mocked_secret_response)
        override_service(service)

        response = client_with_user.post("/secrets", json=secret_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == mocked_secret_response.name
        assert json_response["secret_type"] == mocked_secret_response.secret_type


class TestUpdate:
    def test_update_forbidden(self, client_with_user, monkeypatch):
        secret_update = {
            "name": "Test Secret 1",
            "description": "New description",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return False

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.patch(f"/secrets/{secret_ID}", json=secret_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_update_success(self, client_with_user, override_service, monkeypatch, mocked_secret_response):
        secret_update = {
            "name": "Test Secret 1",
            "description": "New description",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        service = MockSecretService(updated_secret=mocked_secret_response)
        override_service(service)

        response = client_with_user.patch(f"/secrets/{secret_ID}", json=secret_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == mocked_secret_response.name
        assert json_response["secret_type"] == mocked_secret_response.secret_type


class TestPatchAction:
    def test_patch_action_forbidden(self, client_with_user, monkeypatch):
        secret_patch = {
            "action": "create",
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return False

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.patch(f"/secrets/{secret_ID}/actions", json=secret_patch)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_patch_action_value_error(self, client_with_user, monkeypatch):
        secret_patch = {
            "action": "unknown",
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.patch(f"/secrets/{secret_ID}/actions", json=secret_patch)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_action_success(self, client_with_user, override_service, monkeypatch, mocked_secret_response):
        secret_patch = {
            "action": "create",
        }

        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        service = MockSecretService(patch_secret=mocked_secret_response)
        override_service(service)

        response = client_with_user.patch(f"/secrets/{secret_ID}/actions", json=secret_patch)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == mocked_secret_response.name
        assert json_response["integration"]["id"] == str(mocked_secret_response.integration.id)


class TestDelete:
    def test_delete_forbidden(self, client_with_user, monkeypatch):
        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return False

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        response = client_with_user.delete(f"/secrets/{secret_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_delete_success(self, client_with_user, override_service, monkeypatch):
        async def mock_user_has_access_to_resource(user: UserDTO, resource_id: str | UUID, action: str):
            return True

        monkeypatch.setattr(api_secret, "user_has_access_to_resource", mock_user_has_access_to_resource)

        service = MockSecretService()
        override_service(service)

        response = client_with_user.delete(f"/secrets/{secret_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockSecretService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/secrets/{secret_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockSecretService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/secrets/{secret_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []
