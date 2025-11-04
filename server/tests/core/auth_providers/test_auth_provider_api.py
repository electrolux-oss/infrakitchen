from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from core.auth_providers.api import router
from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.schema import (
    AuthProviderUpdate,
    AuthProviderCreate,
)
from core import UserDTO
import core.auth_providers.api as api_auth_provider

AUTH_PROVIDER_ID = "123e4567-e89b-12d3-a456-426614174000"


class MockAuthProviderService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_auth_provider=None,
        updated_auth_provider=None,
        tree=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_auth_provider = created_auth_provider
        self._updated_auth_provider = updated_auth_provider
        self._actions = actions

    async def get_by_id(self, auth_provider_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, auth_provider: AuthProviderCreate, requester: UserDTO):
        return self._created_auth_provider

    async def update(self, auth_provider_id: str, auth_provider: AuthProviderUpdate, requester: UserDTO):
        return self._updated_auth_provider

    async def delete(self, auth_provider_id: str, requester: UserDTO):
        pass

    async def get_actions(self, auth_provider_id: str, requester: UserDTO):
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
    def _override(service: MockAuthProviderService):
        async def _get_service():
            return service

        app.dependency_overrides[get_auth_provider_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app, mocked_user_response):
    user = mocked_user_response

    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = user
        return await call_next(request)

    return TestClient(app)


class TestGetById:
    def test_get_by_id_success(self, client, override_service, auth_provider_response):
        service = MockAuthProviderService(return_value=auth_provider_response)
        override_service(service)

        response = client.get(f"/auth_providers/{AUTH_PROVIDER_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == auth_provider_response.name
        assert json_response["auth_provider"] == auth_provider_response.auth_provider

    def test_get_by_id_not_found(self, client, override_service):
        auth_provider_id = "invalid_id"
        service = MockAuthProviderService(return_value=None)
        override_service(service)

        response = client.get(f"/auth_providers/{auth_provider_id}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "AuthProvider not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockAuthProviderService(total=0, items=[])
        override_service(service)

        response = client.get("/auth_providers")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "auth_providers 0-0/0"

    def test_get_all_with_items(self, client, override_service, auth_provider_response):
        items = [auth_provider_response, auth_provider_response]
        total = 5
        service = MockAuthProviderService(total=total, items=items)
        override_service(service)

        response = client.get("/auth_providers")

        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"auth_providers 0-{len(items)}/{total}"


class TestCreate:
    def test_create_forbidden(self, client_with_user, monkeypatch):
        auth_provider_body = {
            "name": "Test AuthProvider",
            "auth_provider": "microsoft",
            "configuration": {
                "tenant_id": "tenant123",
                "client_id": "client123",
                "client_secret": "secret123",
                "auth_provider": "microsoft",
                "redirect_uri": "http://localhost/callback",
            },
        }

        async def mock_user_is_super_admin(user_id: str | UUID) -> bool:
            return False

        monkeypatch.setattr(api_auth_provider, "user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.post("/auth_providers", json=auth_provider_body)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, auth_provider_response, monkeypatch):
        auth_provider_body = {
            "name": "Test AuthProvider",
            "auth_provider": "microsoft",
            "enabled": True,
            "description": "Test description",
            "filter_by_domain": [],
            "configuration": {
                "tenant_id": "tenant123",
                "client_id": "client123",
                "client_secret": "secret123",
                "auth_provider": "microsoft",
                "redirect_uri": "http://localhost/callback",
            },
        }

        async def mock_user_is_super_admin(user_id: str | UUID) -> bool:
            return True

        monkeypatch.setattr(api_auth_provider, "user_is_super_admin", mock_user_is_super_admin)

        service = MockAuthProviderService(created_auth_provider=auth_provider_response)
        override_service(service)

        response = client_with_user.post("/auth_providers", json=auth_provider_body)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == auth_provider_response.name
        assert json_response["auth_provider"] == auth_provider_response.auth_provider


class TestUpdate:
    def test_update_forbidden(self, client_with_user, monkeypatch):
        auth_provider_update = {
            "name": "Test AuthProvider 1",
            "description": "New description",
        }

        async def mock_user_is_super_admin(user_id: str | UUID) -> bool:
            return False

        monkeypatch.setattr(api_auth_provider, "user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.patch(f"/auth_providers/{AUTH_PROVIDER_ID}", json=auth_provider_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_update_success(self, client_with_user, override_service, monkeypatch, auth_provider_response):
        auth_provider_update = {
            "name": "Test AuthProvider 1",
            "description": "New description",
        }

        async def mock_user_is_super_admin(user_id: str | UUID) -> bool:
            return True

        monkeypatch.setattr(api_auth_provider, "user_is_super_admin", mock_user_is_super_admin)

        service = MockAuthProviderService(updated_auth_provider=auth_provider_response)
        override_service(service)

        response = client_with_user.patch(f"/auth_providers/{AUTH_PROVIDER_ID}", json=auth_provider_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == auth_provider_response.name
        assert json_response["auth_provider"] == auth_provider_response.auth_provider


class TestDelete:
    def test_delete_forbidden(self, client_with_user, monkeypatch):
        async def mock_user_is_super_admin(user_id: str | UUID) -> bool:
            return False

        monkeypatch.setattr(api_auth_provider, "user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.delete(f"/auth_providers/{AUTH_PROVIDER_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_delete_success(self, client_with_user, override_service, monkeypatch):
        async def mock_user_is_super_admin(user_id: str | UUID) -> bool:
            return True

        monkeypatch.setattr(api_auth_provider, "user_is_super_admin", mock_user_is_super_admin)

        service = MockAuthProviderService()
        override_service(service)

        response = client_with_user.delete(f"/auth_providers/{AUTH_PROVIDER_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockAuthProviderService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/auth_providers/{AUTH_PROVIDER_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockAuthProviderService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/auth_providers/{AUTH_PROVIDER_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []
