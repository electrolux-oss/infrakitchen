from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from core.users.api import router
from core.users.dependencies import get_user_service
from core.users.schema import UserUpdate, UserCreate
from core import UserDTO
from core.base_models import PatchBodyModel

USER_ID = "abc123"


class MockUserService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_user=None,
        updated_user=None,
        patch_user=None,
        actions=None,
        linked_user=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_user = created_user
        self._updated_user = updated_user
        self._patch_user = patch_user
        self._actions = actions
        self._linked_user = linked_user

    async def get_by_id(self, user_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, user: UserCreate, requester: UserDTO):
        return self._created_user

    async def update(self, user_id: str, user: UserUpdate, requester: UserDTO):
        return self._updated_user

    async def patch(self, user_id, body: PatchBodyModel, requester: UserDTO):
        return self._patch_user

    async def get_actions(self, user_id: str, requester: str | UUID):
        return self._actions

    async def link_accounts(self, primary_user_id: str, secondary_user_id: str, requester: UserDTO):
        return self._linked_user

    async def unlink_accounts(self, primary_user_id: str, secondary_user_id: str, requester: UserDTO):
        return self._linked_user


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
    def _override(service: MockUserService):
        async def _get_service():
            return service

        app.dependency_overrides[get_user_service] = _get_service

    return _override


@pytest.fixture
def client_with_user(app):
    class MockUser:
        id = "user123"
        primary_account = []
        secondary_accounts = []

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
    def test_get_by_id_success(self, client, override_service, mocked_user_response):
        service = MockUserService(return_value=mocked_user_response)
        override_service(service)

        response = client.get(f"/users/{USER_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["identifier"] == mocked_user_response.identifier
        assert json_response["provider"] == mocked_user_response.provider

    def test_get_by_id_not_found(self, client, override_service):
        user_id = "invalid_id"
        service = MockUserService(return_value=None)
        override_service(service)

        response = client.get(f"/users/{user_id}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "User not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockUserService(total=0, items=[])
        override_service(service)

        response = client.get("/users")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "users 0-0/0"

    def test_get_all_with_items(self, client, override_service, mocked_user_response):
        user1 = mocked_user_response
        user2 = mocked_user_response.model_copy(deep=True)
        user2.id = uuid4()
        items = [user1, user2]
        total = 5
        service = MockUserService(total=total, items=items)
        override_service(service)

        response = client.get("/users")

        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"users 0-{len(items)}/{total}"


class TestCreate:
    def test_create_forbidden(self, client_without_user):
        user_create = {"identifier": "test_user", "email": "test@example.com"}

        response = client_without_user.post("/users", json=user_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_user_success(self, client_with_user, override_service, mocked_user_response, monkeypatch):
        user_create = {"identifier": "test_user", "email": "test@example.com"}

        service = MockUserService(created_user=mocked_user_response)
        override_service(service)

        async def mock_user_is_super_admin(user_id: str) -> bool:
            return True

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.post("/users", json=user_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["identifier"] == mocked_user_response.identifier
        assert json_response["provider"] == mocked_user_response.provider

    def test_create_user_forbidden(self, client_with_user, override_service, monkeypatch):
        user_create = {"identifier": "test_user", "email": "test@example.com"}
        service = MockUserService()
        override_service(service)

        async def mock_user_is_super_admin(user_id: str) -> bool:
            return False

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)
        response = client_with_user.post("/users", json=user_create)
        assert response.status_code == HTTPStatus.FORBIDDEN


class TestUpdate:
    def test_update_forbidden(self, client_with_user, monkeypatch):
        user_update = {"identifier": "test_user", "email": "test@example.com"}

        async def mock_user_is_super_admin(user_id: str) -> bool:
            return False

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.patch(f"/users/{USER_ID}", json=user_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_update_success(self, client_with_user, override_service, monkeypatch, mocked_user_response):
        user_update = {"identifier": "test_user", "email": "test@example.com"}

        async def mock_user_is_super_admin(user_id: str) -> bool:
            return True

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        service = MockUserService(updated_user=mocked_user_response)
        override_service(service)

        response = client_with_user.patch(f"/users/{USER_ID}", json=user_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["identifier"] == mocked_user_response.identifier
        assert json_response["provider"] == mocked_user_response.provider


class TestGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockUserService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/users/{USER_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockUserService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/users/{USER_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []


class TestLinkAccounts:
    def test_link_accounts_forbidden(self, client_with_user, monkeypatch):
        async def mock_user_is_super_admin(user_id: str) -> bool:
            return False

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.post(f"/users/{USER_ID}/link/secondary_user_id")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_link_accounts_success(self, client_with_user, override_service, monkeypatch, mocked_user_response):
        async def mock_user_is_super_admin(user_id: str) -> bool:
            return True

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        service = MockUserService(linked_user=mocked_user_response)
        override_service(service)

        response = client_with_user.post(f"/users/{USER_ID}/link/secondary_user_id")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["identifier"] == mocked_user_response.identifier
        assert json_response["provider"] == mocked_user_response.provider

    def test_unlink_accounts_forbidden(self, client_with_user, monkeypatch):
        async def mock_user_is_super_admin(user_id: str) -> bool:
            return False

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        response = client_with_user.delete(f"/users/{USER_ID}/link/secondary_user_id")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_unlink_accounts_success(self, client_with_user, override_service, monkeypatch, mocked_user_response):
        async def mock_user_is_super_admin(user_id: str) -> bool:
            return True

        monkeypatch.setattr("core.users.api.user_is_super_admin", mock_user_is_super_admin)

        service = MockUserService(linked_user=mocked_user_response)
        override_service(service)

        response = client_with_user.delete(f"/users/{USER_ID}/link/secondary_user_id")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["identifier"] == mocked_user_response.identifier
        assert json_response["provider"] == mocked_user_response.provider
