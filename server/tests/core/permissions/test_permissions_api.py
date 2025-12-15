from datetime import datetime
import uuid

import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from http import HTTPStatus

from core.constants.model import ModelActions
from core.permissions.api import router
from core.permissions.schema import RoleUsersResponse
from core.users.model import UserDTO
from tests.fixtures.test_permission_fixtures import MockPermissionsService

ROLE_NAME = "test_role"


@pytest.fixture(autouse=True)
def app():
    app = FastAPI()
    app.include_router(router)
    return app


@pytest.fixture
def client_without_user(app):
    return TestClient(app)


@pytest.fixture
def client(app):
    class MockUser:
        id = uuid.uuid4()
        identifier = "super_admin"
        primary_account = True

    user = MockUser()

    @app.middleware("http")
    async def add_user(request, call_next):
        request.state.user = user
        return await call_next(request)

    return TestClient(app)


@pytest.fixture
def mock_user_super_admin(monkeypatch):
    async def mock_is_super_admin(user: UserDTO) -> bool:
        return user.identifier == "super_admin"

    async def mock_has_access(user: UserDTO, resource_id: str, action: str, entity_name: str) -> bool:
        if action == "admin":
            return user.identifier != "regular_user"
        return True

    monkeypatch.setattr("core.permissions.api.user_is_super_admin", mock_is_super_admin)
    monkeypatch.setattr("core.permissions.api.user_has_access_to_entity", mock_has_access)


MOCK_SUPER_ADMIN_USER = UserDTO(id=uuid.uuid4(), identifier="super_admin", provider="test_provider")
MOCK_REGULAR_USER = UserDTO(id=uuid.uuid4(), identifier="regular_user", provider="test_provider")


class TestGetAllRoles:
    ROLE_COUNT = 2

    def test_get_all_roles_success(self, client, override_permission_service, mock_role_data):
        mock_roles = [mock_role_data, mock_role_data]
        service = MockPermissionsService(roles=mock_roles, role_count=self.ROLE_COUNT)
        override_permission_service(service)

        response = client.get("/permissions/roles")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == f"roles 0-{len(mock_roles)}/{self.ROLE_COUNT}"
        assert len(json_response) == self.ROLE_COUNT
        assert json_response[0]["ptype"] == "g"

    def test_get_all_roles_empty(self, client, override_permission_service):
        service = MockPermissionsService(roles=[], role_count=0)
        override_permission_service(service)

        response = client.get("/permissions/roles")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == "roles 0-0/0"
        assert len(json_response) == 0


class TestGetRoleById:
    ROLE_ID = str(uuid.uuid4())

    def test_get_by_id_success(self, client, override_permission_service, mock_role_data):
        mock_role_data["id"] = self.ROLE_ID
        service = MockPermissionsService(single_role=mock_role_data)
        override_permission_service(service)

        response = client.get(f"/permissions/{self.ROLE_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response["id"] == self.ROLE_ID

    def test_get_by_id_not_found(self, client, override_permission_service):
        service = MockPermissionsService(single_role=None)
        override_permission_service(service)

        response = client.get(f"/permissions/{self.ROLE_ID}")

        assert response.status_code == HTTPStatus.NOT_FOUND
        assert response.json()["detail"] == "Role not found"


class TestGetUserRoles:
    USER_ID = str(uuid.uuid4())
    ROLE_COUNT = 1

    def test_get_user_roles_success(self, client, override_permission_service, mock_role_data):
        mock_role_data["v0"] = f"user:{self.USER_ID}"
        service = MockPermissionsService(roles=[mock_role_data], role_count=self.ROLE_COUNT)
        override_permission_service(service)

        response = client.get(f"/permissions/user/{self.USER_ID}/roles")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == f"roles 0-1/{self.ROLE_COUNT}"
        assert len(json_response) == self.ROLE_COUNT
        assert json_response[0]["v0"] == f"user:{self.USER_ID}"

    def test_get_user_roles_empty(self, client, override_permission_service):
        service = MockPermissionsService(roles=[], role_count=0)
        override_permission_service(service)

        response = client.get(f"/permissions/user/{self.USER_ID}/roles")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == "roles 0-0/0"
        assert len(json_response) == 0


class TestGetRoleApiPermissions:
    ROLE_NAME = "guest"
    POLICY_COUNT = 2

    def test_get_role_api_permissions_success(self, client, override_permission_service, mock_policy_data):
        mock_policies = [mock_policy_data, mock_policy_data]
        service = MockPermissionsService(role_api_permissions=mock_policies, policy_count=self.POLICY_COUNT)
        override_permission_service(service)

        response = client.get(f"/permissions/role/{self.ROLE_NAME}/api/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == f"policies 0-2/{self.POLICY_COUNT}"
        assert len(json_response) == self.POLICY_COUNT
        assert json_response[0]["v1"].startswith("api:")

    def test_get_role_api_permissions_empty(self, client, override_permission_service):
        service = MockPermissionsService(role_api_permissions=[], policy_count=0)
        override_permission_service(service)

        response = client.get(f"/permissions/role/{self.ROLE_NAME}/api/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == "policies 0-0/0"
        assert len(json_response) == 0


class TestGetUsersByRole:
    ROLE_NAME = "test_role"
    USER_COUNT = 2

    @pytest.fixture
    def mock_role_users(self):
        return [
            RoleUsersResponse(
                id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                email=None,
                display_name=None,
                identifier="user_one",
                provider="providerA",
                role=ROLE_NAME,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ).model_dump(by_alias=True),
            RoleUsersResponse(
                id=uuid.uuid4(),
                user_id=uuid.uuid4(),
                email=None,
                display_name=None,
                identifier="user_two",
                provider="providerB",
                role=ROLE_NAME,
                created_at=datetime.now(),
                updated_at=datetime.now(),
            ).model_dump(by_alias=True),
        ]

    def test_get_users_by_role_success(self, client, override_permission_service, mock_role_users):
        service = MockPermissionsService(users_by_role=mock_role_users, user_count=self.USER_COUNT)
        override_permission_service(service)

        response = client.get(f"/permissions/role/{self.ROLE_NAME}/users")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == f"users 0-2/{self.USER_COUNT}"
        assert len(json_response) == self.USER_COUNT
        assert json_response[0]["identifier"] == "user_one"

    def test_get_users_by_role_empty(self, client, override_permission_service):
        service = MockPermissionsService(users_by_role=[], user_count=0)
        override_permission_service(service)

        response = client.get(f"/permissions/role/{self.ROLE_NAME}/users")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert response.headers["content-range"] == "users 0-0/0"
        assert len(json_response) == 0


class TestGetEntityPermissions:
    ENTITY_NAME = "project"
    ENTITY_ID = str(uuid.uuid4())

    def test_get_entity_permissions_success(self, client, override_permission_service, mock_policy_data):
        mock_policy_data["v1"] = f"{self.ENTITY_NAME}:{self.ENTITY_ID}"
        mock_policies = [mock_policy_data]
        service = MockPermissionsService(entity_permissions=mock_policies)
        override_permission_service(service)

        response = client.get(f"/permissions/{self.ENTITY_NAME}/{self.ENTITY_ID}/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 1
        assert json_response[0]["v1"] == f"{self.ENTITY_NAME}:{self.ENTITY_ID}"

    def test_get_entity_permissions_empty(self, client, override_permission_service):
        service = MockPermissionsService(entity_permissions=[])
        override_permission_service(service)

        response = client.get(f"/permissions/{self.ENTITY_NAME}/{self.ENTITY_ID}/policies")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert len(json_response) == 0


class TestCreateRole:
    PAYLOAD = {"role": "new_role", "user_id": str(uuid.uuid4())}

    def test_create_role_super_admin_success(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService()
        override_permission_service(service)

        response = client.post("/permissions/role", json=self.PAYLOAD)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["v1"] == self.PAYLOAD["role"]
        assert json_response["v0"] == f"user:{self.PAYLOAD['user_id']}"

    def test_create_role_access_denied(
        self, app, client_without_user, override_permission_service, mock_user_super_admin
    ):
        @app.middleware("http")
        async def set_regular_user(request: Request, call_next):
            request.state.user = MOCK_REGULAR_USER
            return await call_next(request)

        service = MockPermissionsService()
        override_permission_service(service)

        response = client_without_user.post("/permissions/role", json=self.PAYLOAD)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied"


class TestAssignUserToRole:
    ROLE_NAME = "assignee_role"
    USER_ID = str(uuid.uuid4())

    def test_assign_user_to_role_super_admin_success(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService()
        override_permission_service(service)

        response = client.post(f"/permissions/role/{self.ROLE_NAME}/{self.USER_ID}")
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["v1"] == self.ROLE_NAME
        assert json_response["v0"] == f"user:{self.USER_ID}"

    def test_assign_user_to_role_access_denied(
        self, app, client_without_user, override_permission_service, mock_user_super_admin
    ):
        @app.middleware("http")
        async def set_regular_user(request: Request, call_next):
            request.state.user = MOCK_REGULAR_USER
            return await call_next(request)

        service = MockPermissionsService()
        override_permission_service(service)

        response = client_without_user.post(f"/permissions/role/{self.ROLE_NAME}/{self.USER_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied"


class TestCreateApiPolicy:
    PAYLOAD = {"role": "admin", "api": "resource", "action": "read"}

    def test_create_api_policy_super_admin_success(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService()
        override_permission_service(service)

        response = client.post("/permissions/policy/api", json=self.PAYLOAD)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["v0"] == self.PAYLOAD["role"]
        assert json_response["v1"] == f"api:{self.PAYLOAD['api']}"
        assert json_response["v2"] == self.PAYLOAD["action"]

    def test_create_api_policy_access_denied(
        self, app, client_without_user, override_permission_service, mock_user_super_admin
    ):
        @app.middleware("http")
        async def set_regular_user(request: Request, call_next):
            request.state.user = MOCK_REGULAR_USER
            return await call_next(request)

        service = MockPermissionsService()
        override_permission_service(service)

        response = client_without_user.post("/permissions/policy/api", json=self.PAYLOAD)

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied"


class TestCreateEntityPolicy:
    PAYLOAD = dict(role="project_admin", entity_name="resource", entity_id=str(uuid.uuid4()), action="read")

    def test_create_entity_policy_success(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService()
        override_permission_service(service)

        response = client.post("/permissions/policy/entity", json=self.PAYLOAD)
        json_response = response.json()

        assert response.status_code == HTTPStatus.CREATED
        assert json_response["v0"] == self.PAYLOAD["role"]
        assert json_response["v1"] == f"{self.PAYLOAD['entity_name']}:{self.PAYLOAD['entity_id']}"
        assert json_response["v2"] == self.PAYLOAD["action"]


class TestDeletePermission:
    ENTITY_ID = str(uuid.uuid4())

    def test_delete_success(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService(actions=[ModelActions.DELETE])
        override_permission_service(service)

        response = client.delete(f"/permissions/{self.ENTITY_ID}")

        assert response.status_code == HTTPStatus.NO_CONTENT

    def test_delete_access_denied(self, app, client_without_user, override_permission_service, mock_user_super_admin):
        @app.middleware("http")
        async def set_regular_user(request: Request, call_next):
            request.state.user = MOCK_REGULAR_USER
            return await call_next(request)

        service = MockPermissionsService(actions=[])
        override_permission_service(service)

        response = client_without_user.delete(f"/permissions/{self.ENTITY_ID}")

        assert response.status_code == HTTPStatus.FORBIDDEN
        assert response.json()["detail"] == "Access denied for action delete"


class TestGetActions:
    ENTITY_ID = str(uuid.uuid4())
    ACTIONS = ["read", "write"]

    def test_get_actions_success(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService(actions=self.ACTIONS)
        override_permission_service(service)

        response = client.get(f"/permissions/{self.ENTITY_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == self.ACTIONS

    def test_get_actions_empty(self, client, override_permission_service, mock_user_super_admin):
        service = MockPermissionsService(actions=[])
        override_permission_service(service)

        response = client.get(f"/permissions/{self.ENTITY_ID}/actions")
        json_response = response.json()

        assert response.status_code == HTTPStatus.OK
        assert json_response == []
