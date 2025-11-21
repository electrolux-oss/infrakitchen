import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from core.permissions.dependencies import get_permission_service
from core.permissions.api import router
from core.users.schema import UserShort

ROLE_NAME = "test_role"


class MockPermissionsService:
    def __init__(
        self,
        users_by_role=None,
    ):
        self._users_by_role = users_by_role

    async def get_users_by_role(self, role_name: str):
        return self._users_by_role


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
    def _override(service: MockPermissionsService):
        async def _get_service():
            return service

        app.dependency_overrides[get_permission_service] = _get_service

    return _override


class TestGetUsersByRole:
    def test_get_users_by_role_success(self, client, override_service):
        users_by_role = [
            UserShort(id=uuid.uuid4(), identifier="user_one", provider="providerA"),
            UserShort(id=uuid.uuid4(), identifier="user_two", provider="providerB"),
        ]

        service = MockPermissionsService(users_by_role=users_by_role)
        override_service(service)

        response = client.get(f"/permissions/role/{ROLE_NAME}/users")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 2
        assert json_response[0]["identifier"] == "user_one"
        assert json_response[1]["identifier"] == "user_two"

    def test_get_users_by_role_empty(self, client, override_service):
        users_by_role = []

        service = MockPermissionsService(users_by_role=users_by_role)
        override_service(service)

        response = client.get(f"/permissions/role/{ROLE_NAME}/users")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 0
