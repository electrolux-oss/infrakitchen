from datetime import datetime
from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.executors.api import router
from application.executors.dependencies import get_executor_service
from application.executors.schema import UserExecutorResponse
from core.constants.model import ModelActions

EXECUTOR_ID = "exec123"


class MockExecutorService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created=None,
        updated=None,
        patched=None,
        actions=None,
        policies=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created = created
        self._updated = updated
        self._patched = patched
        self._actions = actions
        self._policies = policies or []

    async def get_by_id(self, executor_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, executor, requester):
        return self._created

    async def update(self, executor_id, executor, requester):
        return self._updated

    async def patch_action(self, executor_id, body, requester):
        return self._patched

    async def delete(self, executor_id, requester):
        pass

    async def get_actions(self, executor_id, requester):
        return self._actions

    async def get_user_executor_policies(self, user_id: str):
        return self._policies


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
    def _override(service: MockExecutorService):
        async def _get_service():
            return service

        app.dependency_overrides[get_executor_service] = _get_service

    return _override


class TestGetById:
    def test_success(self, client, override_service, executor_response):
        override_service(MockExecutorService(return_value=executor_response))

        response = client.get(f"/executors/{EXECUTOR_ID}")
        assert response.status_code == HTTPStatus.OK
        assert response.json()["name"] == executor_response.name

    def test_not_found(self, client, override_service):
        override_service(MockExecutorService(return_value=None))

        response = client.get(f"/executors/{EXECUTOR_ID}")
        assert response.status_code == HTTPStatus.NOT_FOUND


class TestGetAll:
    def test_empty(self, client, override_service):
        override_service(MockExecutorService(total=0, items=[]))

        response = client.get("/executors")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "executors 0-0/0"

    def test_with_items(self, client, override_service, executor_response):
        total = 5
        items = [executor_response, executor_response]
        override_service(MockExecutorService(total=total, items=items))

        response = client.get("/executors")
        assert response.status_code == HTTPStatus.OK
        assert len(response.json()) == 2
        assert response.headers["Content-Range"] == f"executors 0-{len(items)}/{total}"


class TestCreate:
    def test_forbidden(self, client_without_user):
        data = {
            "name": "TestExecutor",
            "description": "Test description",
            "source_code_id": str(uuid4()),
        }
        response = client_without_user.post("/executors", json=data)
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_success(self, client_with_user, override_service, executor_response):
        created = executor_response
        override_service(MockExecutorService(created=created))
        data = {
            "name": created.name,
            "description": created.description,
            "source_code_id": str(created.source_code.id),
        }

        response = client_with_user.post("/executors", json=data)
        assert response.status_code == HTTPStatus.CREATED
        assert response.json()["name"] == created.name


class TestExecutorUpdate:
    def test_update_success(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "updated_description",
            "command_args": "-plan",
            "source_code_id": str(uuid4()),
            "source_code_folder": "new/folder",
        }

        service = MockExecutorService(updated=executor_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == executor_response.name
        assert json_response["id"] == str(executor_response.id)

    def test_update_forbidden(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "updated_description",
            "command_args": "-plan",
            "source_code_id": str(uuid4()),
            "source_code_folder": "new/folder",
        }

        service = MockExecutorService(updated=executor_response, actions=[])
        override_service(service)

        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}

    def test_update_source_code_version_success(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "desc",
            "command_args": "-apply",
            "source_code_id": str(uuid4()),
            "source_code_version": "v2.0.0",
            "source_code_folder": "executors/",
        }

        service = MockExecutorService(updated=executor_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)
        assert response.status_code == HTTPStatus.OK

    def test_update_source_code_branch_success(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "desc",
            "command_args": "-apply",
            "source_code_id": str(uuid4()),
            "source_code_branch": "develop",
            "source_code_folder": "executors/",
        }

        service = MockExecutorService(updated=executor_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)
        assert response.status_code == HTTPStatus.OK

    def test_update_integration_ids_success(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "desc",
            "command_args": "-apply",
            "source_code_id": str(uuid4()),
            "integration_ids": [str(uuid4())],
            "source_code_folder": "executors/",
        }

        service = MockExecutorService(updated=executor_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)
        assert response.status_code == HTTPStatus.OK

    def test_update_secret_ids_success(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "desc",
            "command_args": "-apply",
            "source_code_id": str(uuid4()),
            "secret_ids": [str(uuid4())],
            "source_code_folder": "executors/",
        }

        service = MockExecutorService(updated=executor_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)
        assert response.status_code == HTTPStatus.OK

    def test_update_labels_success(self, client_with_user, executor_response, override_service):
        executor_update = {
            "description": "desc",
            "command_args": "-apply",
            "source_code_id": str(uuid4()),
            "labels": ["label1", "label2"],
            "source_code_folder": "executors/",
        }

        service = MockExecutorService(updated=executor_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.put(f"/executors/{EXECUTOR_ID}", json=executor_update)
        assert response.status_code == HTTPStatus.OK


class TestExecutorActionsPatch:
    def test_patch_forbidden(self, client_with_user, override_service):
        executor_patch = {
            "action": "create",
        }
        override_service(MockExecutorService(actions=[]))

        response = client_with_user.patch(f"/executors/{EXECUTOR_ID}/actions", json=executor_patch)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action create"}

    def test_patch_value_error(self, client_with_user):
        executor_patch = {
            "action": "unknown",
        }

        response = client_with_user.patch(f"/executors/{EXECUTOR_ID}/actions", json=executor_patch)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_success(self, client_with_user, override_service, executor_response):
        executor_patch = {
            "action": "create",
        }

        service = MockExecutorService(patched=executor_response, actions=[ModelActions.CREATE])
        override_service(service)

        response = client_with_user.patch(f"/executors/{EXECUTOR_ID}/actions", json=executor_patch)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == executor_response.name
        assert json_response["id"] == str(executor_response.id)


class TestExecutorDelete:
    def test_delete_forbidden(self, client_with_user, override_service):
        override_service(MockExecutorService(actions=[]))

        response = client_with_user.delete(f"/executors/{EXECUTOR_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}

    def test_delete_success(self, client_with_user, override_service):
        service = MockExecutorService(actions=[ModelActions.DELETE])
        override_service(service)

        response = client_with_user.delete(f"/executors/{EXECUTOR_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestExecutorGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockExecutorService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/executors/{EXECUTOR_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockExecutorService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/executors/{EXECUTOR_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []


# Permissions
class TestGetUserExecutorsPolicies:
    USER_ID = str(uuid4())

    @pytest.mark.asyncio
    async def test_get_user_executors_success(self, client_with_user, override_service):
        mock_user_policy_data = UserExecutorResponse(
            id=uuid4(),
            executor_id=uuid4(),
            executor_name="executor",
            action="read",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        mock_executors = [mock_user_policy_data, mock_user_policy_data]

        service = MockExecutorService(policies=mock_executors)
        override_service(service)

        response = client_with_user.get(f"/executors/permissions/user/{self.USER_ID}/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 2
        assert json_response[0]["executor_name"] == "executor"

    @pytest.mark.asyncio
    async def test_get_user_executors_empty(self, client_with_user, override_service):
        service = MockExecutorService(policies=[])
        override_service(service)

        response = client_with_user.get(f"/executors/permissions/user/{self.USER_ID}/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 0
