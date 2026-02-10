from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.batch_operations.api import router
from application.batch_operations.dependencies import get_batch_operation_service

BATCH_OPERATION_ID = "batch123"


class MockBatchOperationService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created=None,
        patched=None,
        entity_ids_patched=None,
        actions=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created = created
        self._patched = patched
        self._entity_ids_patched = entity_ids_patched
        self._actions = actions

    async def get_by_id(self, batch_operation_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, batch_operation, requester):
        return self._created

    async def patch_action(self, batch_operation_id, body, requester):
        return self._patched

    async def patch_entity_ids(self, batch_operation_id, body, requester):
        return self._entity_ids_patched

    async def delete(self, batch_operation_id, requester):
        return None

    async def get_actions(self, batch_operation_id, requester):
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


@pytest.fixture
def override_service(app):
    def _override(service: MockBatchOperationService):
        async def _get_service():
            return service

        app.dependency_overrides[get_batch_operation_service] = _get_service

    return _override


class TestGetById:
    def test_success(self, client, override_service, batch_operation_response):
        override_service(MockBatchOperationService(return_value=batch_operation_response))

        response = client.get(f"/batch_operations/{BATCH_OPERATION_ID}")
        assert response.status_code == HTTPStatus.OK
        assert response.json()["name"] == batch_operation_response.name

    def test_not_found(self, client, override_service):
        override_service(MockBatchOperationService(return_value=None))

        response = client.get(f"/batch_operations/{BATCH_OPERATION_ID}")
        assert response.status_code == HTTPStatus.NOT_FOUND


class TestGetAll:
    def test_empty(self, client, override_service):
        override_service(MockBatchOperationService(total=0, items=[]))

        response = client.get("/batch_operations")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "batch_operations 0-0/0"

    def test_with_items(self, client, override_service, batch_operation_response):
        total = 5
        items = [batch_operation_response, batch_operation_response]
        override_service(MockBatchOperationService(total=total, items=items))

        response = client.get("/batch_operations")
        assert response.status_code == HTTPStatus.OK
        assert len(response.json()) == 2
        assert response.headers["Content-Range"] == f"batch_operations 0-{len(items)}/{total}"


class TestCreate:
    def test_forbidden(self, client_without_user):
        data = {
            "name": "BatchOperation",
            "description": "Test description",
            "entity_type": "resource",
            "entity_ids": [str(uuid4())],
        }
        response = client_without_user.post("/batch_operations", json=data)
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_success(self, client_with_user, override_service, batch_operation_response):
        created = batch_operation_response
        override_service(MockBatchOperationService(created=created))
        data = {
            "name": created.name,
            "description": created.description,
            "entity_type": created.entity_type,
            "entity_ids": [str(uuid4())],
        }

        response = client_with_user.post("/batch_operations", json=data)
        assert response.status_code == HTTPStatus.CREATED
        assert response.json()["name"] == created.name


class TestBatchOperationDelete:
    def test_delete_success(self, client_with_user, override_service):
        service = MockBatchOperationService()
        override_service(service)

        response = client_with_user.delete(f"/batch_operations/{BATCH_OPERATION_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestBatchOperationGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockBatchOperationService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/batch_operations/{BATCH_OPERATION_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockBatchOperationService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/batch_operations/{BATCH_OPERATION_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []


class TestBatchOperationEntityIdsPatch:
    def test_patch_entity_ids_forbidden_without_user(self, client_without_user):
        patch_body = {
            "action": "remove",
            "entity_ids": [str(uuid4())],
        }

        response = client_without_user.patch(
            f"/batch_operations/{BATCH_OPERATION_ID}/entity_ids",
            json=patch_body,
        )

        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_patch_entity_ids_forbidden(self, client_with_user, override_service):
        patch_body = {
            "action": "remove",
            "entity_ids": [str(uuid4())],
        }
        override_service(MockBatchOperationService(actions=[]))

        response = client_with_user.patch(
            f"/batch_operations/{BATCH_OPERATION_ID}/entity_ids",
            json=patch_body,
        )

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action remove"}

    def test_patch_entity_ids_success(self, client_with_user, override_service, batch_operation_response):
        patch_body = {
            "action": "remove",
            "entity_ids": [str(uuid4())],
        }
        service = MockBatchOperationService(
            entity_ids_patched=batch_operation_response,
            actions=["remove"],
        )
        override_service(service)

        response = client_with_user.patch(
            f"/batch_operations/{BATCH_OPERATION_ID}/entity_ids",
            json=patch_body,
        )
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == str(batch_operation_response.id)
