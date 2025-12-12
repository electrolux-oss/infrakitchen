from uuid import uuid4, UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from http import HTTPStatus

from application.storages.api import router
from application.storages.dependencies import get_storage_service
from application.storages.schema import StorageUpdate, StorageCreate
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions

storage_ID = "abc123"


class MockStorageService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created_storage=None,
        updated_storage=None,
        patch_storage=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created_storage = created_storage
        self._updated_storage = updated_storage
        self._patch_storage = patch_storage
        self._actions = actions

    async def get_by_id(self, storage_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, storage: StorageCreate, requester: UserDTO):
        return self._created_storage

    async def update(self, storage_id: str, storage: StorageUpdate, requester: UserDTO):
        return self._updated_storage

    async def patch_action(self, storage_id, body: PatchBodyModel, requester: UserDTO):
        return self._patch_storage

    async def delete(self, storage_id: str, requester: UserDTO):
        pass

    async def get_actions(self, storage_id: str, requester: str | UUID):
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
    def _override(service: MockStorageService):
        async def _get_service():
            return service

        app.dependency_overrides[get_storage_service] = _get_service

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
    def test_get_by_id_success(self, client, override_service, storage_response):
        service = MockStorageService(return_value=storage_response)
        override_service(service)

        response = client.get(f"/storages/{storage_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == storage_response.name
        assert json_response["integration"]["id"] == str(storage_response.integration.id)

    def test_get_by_id_not_found(self, client, override_service):
        storage_id = "invalid_id"
        service = MockStorageService(return_value=None)
        override_service(service)

        response = client.get(f"/storages/{storage_id}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json() == {"detail": "Storage not found"}


class TestGetAll:
    def test_get_all_empty(self, client, override_service):
        service = MockStorageService(total=0, items=[])
        override_service(service)

        response = client.get("/storages")

        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "storages 0-0/0"

    def test_get_all_with_items(self, client, override_service, storage_response):
        storage1 = storage_response
        storage2 = storage_response.model_copy(deep=True)
        storage2.id = uuid4()
        items = [storage1, storage2]
        total = 5
        service = MockStorageService(total=total, items=items)
        override_service(service)

        response = client.get("/storages")

        assert response.status_code == HTTPStatus.OK
        assert response.headers["Content-Range"] == f"storages 0-{len(items)}/{total}"


class TestCreate:
    def test_create_forbidden(self, client_without_user):
        storage_create = {
            "name": "Test Storage 1",
            "description": "New description",
            "storage_type": "tofu",
            "storage_provider": "aws",
            "integration_id": str(uuid4()),
            "configuration": {
                "aws_bucket_name": "test-bucket",
                "aws_region": "us-west-2",
                "storage_provider": "aws",
            },
        }

        response = client_without_user.post("/storages", json=storage_create)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied"}

    def test_create_success(self, client_with_user, override_service, storage_response):
        storage_create = {
            "name": "Test Storage 1",
            "description": "New description",
            "storage_type": "tofu",
            "storage_provider": "aws",
            "integration_id": str(uuid4()),
            "configuration": {
                "aws_bucket_name": "test-bucket",
                "aws_region": "us-west-2",
                "storage_provider": "aws",
            },
        }

        service = MockStorageService(created_storage=storage_response)
        override_service(service)

        response = client_with_user.post("/storages", json=storage_create)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["name"] == storage_response.name
        assert json_response["storage_type"] == storage_response.storage_type


class TestUpdate:
    def test_update_forbidden(self, client_with_user, override_service):
        storage_update = {
            "name": "Test Storage 1",
            "description": "New description",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }
        service = MockStorageService(actions=[])
        override_service(service)

        response = client_with_user.patch(f"/storages/{storage_ID}", json=storage_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}

    def test_update_success(self, client_with_user, override_service, storage_response):
        storage_update = {
            "name": "Test Storage 1",
            "description": "New description",
            "parents": [],
            "children": [],
            "cloud_resource_types": [],
            "labels": [],
            "model_config": {},
        }

        service = MockStorageService(updated_storage=storage_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/storages/{storage_ID}", json=storage_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == storage_response.name
        assert json_response["storage_type"] == storage_response.storage_type


class TestPatchAction:
    def test_patch_action_forbidden(self, client_with_user, override_service):
        storage_patch = {
            "action": "create",
        }
        service = MockStorageService(actions=[])
        override_service(service)

        response = client_with_user.patch(f"/storages/{storage_ID}/actions", json=storage_patch)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action create"}

    def test_patch_action_value_error(self, client_with_user):
        storage_patch = {
            "action": "unknown",
        }

        response = client_with_user.patch(f"/storages/{storage_ID}/actions", json=storage_patch)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_action_success(self, client_with_user, override_service, storage_response):
        storage_patch = {
            "action": "create",
        }

        service = MockStorageService(patch_storage=storage_response, actions=[ModelActions.CREATE])
        override_service(service)

        response = client_with_user.patch(f"/storages/{storage_ID}/actions", json=storage_patch)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == storage_response.name
        assert json_response["integration"]["id"] == str(storage_response.integration.id)


class TestDelete:
    def test_delete_forbidden(self, client_with_user, override_service):
        service = MockStorageService(actions=[])
        override_service(service)

        response = client_with_user.delete(f"/storages/{storage_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}

    def test_delete_success(self, client_with_user, override_service):
        service = MockStorageService(actions=[ModelActions.DELETE])
        override_service(service)

        response = client_with_user.delete(f"/storages/{storage_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockStorageService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/storages/{storage_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockStorageService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/storages/{storage_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []
