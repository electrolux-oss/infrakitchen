from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

import application.integrations.api as api_integration
from application.integrations.api import router
from application.integrations.dependencies import get_integration_service
from application.integrations.schema import IntegrationUpdate
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions

INTEGRATION_ID = "123abc"


class MockIntegrationService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        updated_integration=None,
        created_integration=None,
        patched_integration=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []

        self._created_integration = created_integration
        self._updated_integration = updated_integration
        self._patched_integration = patched_integration

    async def get_by_id(self, integration_id: str):
        return self._return_value

    async def get_all(self, *args, **kwargs):
        return self._items

    async def count(self, filter=None):
        return self._total

    async def create(self, *args, **kwargs):
        return self._return_value

    async def update(self, integration_id: str, integration: IntegrationUpdate, requester: UserDTO):
        return self._updated_integration

    async def patch(self, integration_id: str, body: PatchBodyModel, requester: UserDTO):
        return self._patched_integration

    async def delete(self, integration_id: str, requester: UserDTO):
        pass

    async def get_actions(self, *args, **kwargs):
        return self._return_value


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
    def _override(service: MockIntegrationService):
        async def _get_service():
            return service

        app.dependency_overrides[get_integration_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = uuid4()

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
    def test_get_by_id_success(self, client, override_service, mocked_integration_response, mocked_user_response):
        service = MockIntegrationService(return_value=mocked_integration_response)
        override_service(service)

        response = client.get(f"/integrations/{INTEGRATION_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == mocked_integration_response.name
        assert json_response["integration_type"] == mocked_integration_response.integration_type

    def test_get_by_id_not_found(self, client, override_service):
        service = MockIntegrationService(return_value=None)
        override_service(service)

        response = client.get("/integrations/invalid_id")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Integration not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        override_service(MockIntegrationService(total=0, items=[]))
        response = client.get("/integrations")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "integrations 0-0/0"

    def test_get_all_with_items(self, client, override_service, integration_responses_array):
        total_integrations = len(integration_responses_array)
        override_service(MockIntegrationService(total=total_integrations, items=integration_responses_array))
        response = client.get("/integrations")
        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"integrations 0-{total_integrations}/{total_integrations}"


class TestCreate:
    def test_create_success(self, client_with_user, override_service, mocked_integration_response):
        integration_create = {
            "name": "test_integration",
            "description": "Test integration description",
            "integration_type": "cloud",
            "integration_provider": "aws",
            "labels": [],
            "configuration": {
                "aws_account": "123456789012",
                "aws_access_key_id": "test_access_key",
                "aws_secret_access_key": "test_secret_key",
                "integration_provider": "aws",
            },
        }

        service = MockIntegrationService(return_value=mocked_integration_response)
        override_service(service)

        response = client_with_user.post("/integrations", json=integration_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == mocked_integration_response.name

    def test_create_forbidden(self, client_without_user):
        integration_create = {
            "name": "test_integration",
            "description": "Test integration description",
            "integration_type": "cloud",
            "integration_provider": "aws",
            "labels": [],
            "configuration": {
                "aws_account": "123456789012",
                "aws_access_key_id": "test_access_key",
                "aws_secret_access_key": "test_secret_key",
                "integration_provider": "aws",
            },
        }

        response = client_without_user.post("/integrations", json=integration_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}


class TestUpdate:
    def test_update_forbidden(self, client_with_user, override_service, monkeypatch, mock_user_has_access_to_resource):
        integration_update = {
            "name": "Updated Integration",
            "description": "Updated description",
            "labels": ["updated_label"],
        }

        override_service(MockIntegrationService(return_value=None))
        mock_user_has_access_to_resource(False, api_integration)

        response = client_with_user.patch(f"/integrations/{INTEGRATION_ID}", json=integration_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_update_success(
        self,
        client_with_user,
        override_service,
        mocked_integration_response,
        mock_user_has_access_to_resource,
    ):
        integration_update = {
            "name": "test_integration",
            "description": "Test integration description",
            "integration_type": "cloud",
            "integration_provider": "aws",
            "labels": [],
            "configuration": {
                "aws_account": "123456789012",
                "aws_access_key_id": "test_access_key",
                "aws_secret_access_key": "test_secret_key",
                "integration_provider": "aws",
            },
        }

        mock_user_has_access_to_resource(True, api_integration)
        override_service(MockIntegrationService(updated_integration=mocked_integration_response))

        response = client_with_user.patch(f"/integrations/{INTEGRATION_ID}", json=integration_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == mocked_integration_response.name
        assert json_response["description"] == mocked_integration_response.description


class TestPatchActions:
    def test_patch_action_forbidden(
        self, client_with_user, override_service, monkeypatch, mock_user_has_access_to_resource
    ):
        integration_patch = {"action": "unknown"}
        override_service(MockIntegrationService(return_value=None))
        mock_user_has_access_to_resource(False, api_integration)
        response = client_with_user.patch(f"/integrations/{INTEGRATION_ID}/actions", json=integration_patch)
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_patch_action_value_error(
        self, client_with_user, override_service, monkeypatch, mock_user_has_access_to_resource
    ):
        integration_patch = {"action": "unknown_action"}
        mock_user_has_access_to_resource(True, api_integration)
        response = client_with_user.patch(f"/integrations/{INTEGRATION_ID}/actions", json=integration_patch)
        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_action_success(
        self,
        client_with_user,
        override_service,
        mocked_integration_response,
        mock_user_has_access_to_resource,
    ):
        integration_patch = {"action": ModelActions.DELETE}
        mock_user_has_access_to_resource(True, api_integration)
        override_service(MockIntegrationService(patched_integration=mocked_integration_response))
        response = client_with_user.patch(f"/integrations/{INTEGRATION_ID}/actions", json=integration_patch)
        json_response = response.json()
        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == mocked_integration_response.name
        assert json_response["description"] == mocked_integration_response.description


class TestDelete:
    def test_delete_forbidden(self, client_with_user, override_service, mock_user_has_access_to_resource):
        mock_user_has_access_to_resource(False, api_integration)
        override_service(MockIntegrationService())
        response = client_with_user.delete(f"/integrations/{INTEGRATION_ID}")
        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_delete_success(
        self,
        client_with_user,
        override_service,
        mocked_integration_response,
        mock_user_has_access_to_resource,
    ):
        mock_user_has_access_to_resource(True, api_integration)
        override_service(MockIntegrationService())
        response = client_with_user.delete(f"/integrations/{INTEGRATION_ID}")
        assert response.status_code == HTTPStatus.NO_CONTENT
        assert not response.content


class TestGetActions:
    def test_get_actions_success(
        self, client_with_user, override_service, monkeypatch, mock_user_has_access_to_resource
    ):
        mock_user_has_access_to_resource(True, api_integration)
        override_service(MockIntegrationService(return_value=["read", "write"]))

        response = client_with_user.get(f"/integrations/{INTEGRATION_ID}/actions")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == ["read", "write"]
