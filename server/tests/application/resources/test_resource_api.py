from datetime import datetime
from http import HTTPStatus
from uuid import uuid4

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from application.resources.api import router
from application.resources.dependencies import get_resource_service
from application.resources.schema import ResourceTreeResponse, UserResourceResponse
from core.constants.model import ModelActions

RESOURCE_ID = "res123"


class MockResourceService:
    def __init__(
        self,
        return_value=None,
        total=0,
        items=None,
        created=None,
        updated=None,
        patched=None,
        tree=None,
        actions=None,
        policies=None,
    ):
        self._return_value = return_value
        self._total = total
        self._items = items or []
        self._created = created
        self._updated = updated
        self._patched = patched
        self._tree = tree
        self._actions = actions
        self._policies = policies or []

    async def get_by_id(self, resource_id: str):
        return self._return_value

    async def count(self, filter=None):
        return self._total

    async def get_all(self, *args, **kwargs):
        return self._items

    async def create(self, resource, requester):
        return self._created

    async def update(self, resource_id, resource, requester):
        return self._updated

    async def patch(self, resource_id, resource, requester):
        return self._patched

    async def patch_action(self, resource_id, body, requester):
        return self._patched

    async def delete(self, resource_id, requester):
        pass

    async def get_tree(self, resource_id, direction):
        return self._tree

    async def get_actions(self, resource_id, requester):
        return self._actions

    async def get_user_resource_policies(self, user_id: str):
        return self._policies

    async def sync_workspace(self, resource_id, requester):
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
    def _override(service: MockResourceService):
        async def _get_service():
            return service

        app.dependency_overrides[get_resource_service] = _get_service

    return _override


class TestGetById:
    def test_success(self, client, override_service, resource_response):
        override_service(MockResourceService(return_value=resource_response))

        response = client.get(f"/resources/{RESOURCE_ID}")
        assert response.status_code == HTTPStatus.OK
        assert response.json()["name"] == resource_response.name

    def test_not_found(self, client, override_service):
        override_service(MockResourceService(return_value=None))

        response = client.get(f"/resources/{RESOURCE_ID}")
        assert response.status_code == HTTPStatus.NOT_FOUND


class TestGetAll:
    def test_empty(self, client, override_service):
        override_service(MockResourceService(total=0, items=[]))

        response = client.get("/resources")
        assert response.status_code == HTTPStatus.OK
        assert response.json() == []
        assert response.headers["Content-Range"] == "resources 0-0/0"

    def test_with_items(self, client, override_service, resource_response):
        total = 5
        items = [resource_response, resource_response]
        override_service(MockResourceService(total=total, items=items))

        response = client.get("/resources")
        assert response.status_code == HTTPStatus.OK
        assert len(response.json()) == 2
        assert response.headers["Content-Range"] == f"resources 0-{len(items)}/{total}"


class TestCreate:
    def test_forbidden(self, client_without_user, resource_response):
        data = {
            "name": resource_response.name,
            "description": resource_response.description,
            "template_id": str(uuid4()),
        }
        response = client_without_user.post("/resources", json=data)
        assert response.status_code == HTTPStatus.FORBIDDEN

    def test_success(self, client_with_user, override_service, resource_response):
        created = resource_response
        override_service(MockResourceService(created=created))
        data = {"name": created.name, "description": created.description, "template_id": str(created.template.id)}

        response = client_with_user.post("/resources", json=data)
        assert response.status_code == HTTPStatus.CREATED
        assert response.json()["name"] == created.name


class TestResourcePatch:
    def test_patch_description_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "description": "new_description",
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == resource_response.name
        assert json_response["id"] == str(resource_response.id)

    def test_patch_description_null_error(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "description": None,
        }

        service = MockResourceService(patched=resource_response)
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        assert "At least one field must be provided in ResourcePatch" in response.text

    def test_patch_all_fields_are_null_error(self, client_with_user, resource_response, override_service):
        resource_patch = {}

        service = MockResourceService(patched=resource_response)
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY
        assert "At least one field must be provided in ResourcePatch" in response.text

    def test_patch_source_code_version_id_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "source_code_version_id": str(uuid4()),
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_integration_ids_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "integration_ids": [str(uuid4())],
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_variables_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "variables": [{"name": "var1", "value": "val1"}],
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_dependency_tags_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "dependency_tags": [{"name": "tag1", "value": "val1"}],
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_dependency_config_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "dependency_config": [{"name": "cfg1", "value": "val1"}],
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_labels_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "labels": ["label1", "label2"],
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_workspace_id_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "workspace_id": str(uuid4()),
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_invalid_type_error(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "labels": 123,
        }

        service = MockResourceService(patched=resource_response)
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY

    def test_patch_multiple_fields_success(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "description": "desc",
            "labels": ["label1"],
            "workspace_id": str(uuid4()),
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.OK

    def test_patch_empty_lists_error(self, client_with_user, resource_response, override_service):
        resource_patch = {
            "labels": [],
            "dependency_tags": [],
            "dependency_config": [],
            "integration_ids": [],
            "variables": [],
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.EDIT])
        override_service(service)
        response = client_with_user.patch(f"/resources/{RESOURCE_ID}", json=resource_patch)
        assert response.status_code == HTTPStatus.UNPROCESSABLE_ENTITY


class TestResourceActionsPatch:
    def test_patch_forbidden(self, client_with_user, override_service):
        resource_patch = {
            "action": "create",
        }
        override_service(MockResourceService(actions=[]))

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}/actions", json=resource_patch)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action create"}

    def test_patch_value_error(self, client_with_user):
        resource_patch = {
            "action": "unknown",
        }

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}/actions", json=resource_patch)

        assert response.status_code == HTTPStatus.BAD_REQUEST
        assert response.json() == {"detail": "Invalid action"}

    def test_patch_success(self, client_with_user, override_service, resource_response):
        resource_patch = {
            "action": "create",
        }

        service = MockResourceService(patched=resource_response, actions=[ModelActions.CREATE])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}/actions", json=resource_patch)
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == resource_response.name
        assert json_response["id"] == str(resource_response.id)


class TestResourceDelete:
    def test_delete_forbidden(self, client_with_user, override_service):
        override_service(MockResourceService(actions=[]))

        response = client_with_user.delete(f"/resources/{RESOURCE_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action delete"}

    def test_delete_success(self, client_with_user, override_service):
        service = MockResourceService(actions=[ModelActions.DELETE])
        override_service(service)

        response = client_with_user.delete(f"/resources/{RESOURCE_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT


class TestResourceGetPermissions:
    def test_get_actions_success(self, client_with_user, override_service):
        service = MockResourceService(actions=["read", "write"])
        override_service(service)

        response = client_with_user.get(f"/resources/{RESOURCE_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response[0] == "read"
        assert json_response[1] == "write"

    def test_get_actions_empty(self, client_with_user, override_service):
        service = MockResourceService(actions=[])
        override_service(service)

        response = client_with_user.get(f"/resources/{RESOURCE_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []


class TestResourceTree:
    def test_get_tree_success(self, client_with_user, override_service):
        resource_tree_response = ResourceTreeResponse(
            id=uuid4(), node_id=uuid4(), name="tree1", status="", state="", children=[], template_name="template1"
        )
        service = MockResourceService(tree=resource_tree_response)
        override_service(service)

        response = client_with_user.get(f"/resources/{RESOURCE_ID}/tree/children")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == "tree1"


# Permissions
class TestGetUserResourcesPolicies:
    USER_ID = str(uuid4())

    @pytest.mark.asyncio
    async def test_get_user_resources_success(self, client_with_user, override_service):
        mock_user_policy_data = UserResourceResponse(
            id=uuid4(),
            resource_id=uuid4(),
            resource_name="resource",
            action="read",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        mock_resources = [mock_user_policy_data, mock_user_policy_data]

        service = MockResourceService(policies=mock_resources)
        override_service(service)

        response = client_with_user.get(f"/resources/permissions/user/{self.USER_ID}/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 2
        assert json_response[0]["resource_name"] == "resource"

    @pytest.mark.asyncio
    async def test_get_user_resources_empty(self, client_with_user, override_service):
        service = MockResourceService(policies=[])
        override_service(service)

        response = client_with_user.get(f"/resources/permissions/user/{self.USER_ID}/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 0


class TestSyncWorkspace:
    def test_sync_forbidden(self, client_with_user, override_service):
        override_service(MockResourceService(actions=[]))

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}/sync")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json() == {"detail": "Access denied for action edit"}

    def test_sync_success(self, client_with_user, override_service, resource_response):
        service = MockResourceService(return_value=resource_response, actions=[ModelActions.EDIT])
        override_service(service)

        response = client_with_user.patch(f"/resources/{RESOURCE_ID}/sync")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["name"] == resource_response.name
        assert json_response["id"] == str(resource_response.id)
