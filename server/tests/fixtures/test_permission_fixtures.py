from datetime import datetime
from typing import Any
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from core.permissions.crud import PermissionCRUD
from core.permissions.dependencies import get_permission_service
from core.permissions.model import Permission
from core.permissions.schema import ApiPolicyCreate, EntityPolicyCreate, PermissionResponse, RoleUsersResponse
from core.permissions.service import PermissionService
from core.users.model import UserDTO


class MockPermissionsService:
    def __init__(
        self,
        roles: list[PermissionResponse] | None = None,
        single_role: dict[str, Any] | None = None,
        role_api_permissions: list[PermissionResponse] | None = None,
        users_by_role: list[RoleUsersResponse] | None = None,
        entity_permissions: list[PermissionResponse] | None = None,
        actions: list[str] | None = None,
        role_count: int = 0,
        policy_count: int = 0,
        user_count: int = 0,
    ):
        # Data storage
        self._roles = roles if roles is not None else []
        self._single_role = single_role
        self._role_api_permissions = role_api_permissions if role_api_permissions is not None else []
        self._users_by_role = users_by_role if users_by_role is not None else []
        self._entity_permissions = entity_permissions if entity_permissions is not None else []
        self._actions = actions if actions is not None else []

        # Counts for pagination
        self._role_count = role_count
        self._policy_count = policy_count
        self._user_count = user_count

    async def count_roles(self, filter: dict[str, Any] | None = None) -> int:
        return self._role_count

    async def get_all_roles(
        self, filter: dict[str, Any] | None = None, range: tuple[int, int] | None = None
    ) -> list[PermissionResponse]:
        return self._roles

    async def get_by_id(self, permission_id: str) -> dict[str, Any] | None:
        if self._single_role and str(self._single_role.get("id")) == permission_id:
            return self._single_role
        return None

    async def count(self, filter: dict[str, Any]) -> int:
        if filter.get("ptype") == "g" and filter.get("v0", "").startswith("user:"):
            return self._role_count
        elif filter.get("ptype") == "p" and "api:" in filter.get("v1__like", ""):
            return self._policy_count
        elif filter.get("ptype") == "g" and filter.get("v0__like", "").startswith("user:%") and filter.get("v1"):
            return self._user_count
        return 0

    async def get_all(self, filter: dict[str, Any], range: tuple[int, int] | None = None) -> list[PermissionResponse]:
        return self._roles

    async def get_role_api_permissions(
        self, role_name: str, range: tuple[int, int] | None = None, sort: tuple[str, str] | None = None
    ) -> list[PermissionResponse]:
        return self._role_api_permissions

    async def get_users_by_role(
        self, role_name: str, range: tuple[int, int] | None = None, sort: tuple[str, str] | None = None
    ) -> list[RoleUsersResponse]:
        return self._users_by_role

    async def get_entity_permissions(self, entity_name: str, entity_id: str) -> list[PermissionResponse]:
        return self._entity_permissions

    async def create_role(self, role_name: str, user_id: str | None, requester: UserDTO) -> dict[str, Any]:
        return {"id": str(uuid4()), "ptype": "g", "v0": f"user:{user_id}", "v1": role_name}

    async def assign_user_to_role(self, role_name: str, user_id: str, requester: UserDTO) -> dict[str, Any]:
        return {"id": str(uuid4()), "ptype": "g", "v0": f"user:{user_id}", "v1": role_name}

    async def create_api_policy(self, body: ApiPolicyCreate, requester: UserDTO) -> dict[str, Any]:
        return {"id": str(uuid4()), "ptype": "p", "v0": body.role, "v1": f"api:{body.api}", "v2": body.action}

    async def create_entity_policy(self, body: EntityPolicyCreate, requester: UserDTO) -> dict[str, Any]:
        return {
            "id": str(uuid4()),
            "ptype": "p",
            "v0": body.role,
            "v1": f"{body.entity_name}:{body.entity_id}",
            "v2": body.action,
        }

    async def delete(self, permission_id: str, requester: UserDTO):
        pass

    async def get_actions(self, entity_id: str, requester: UserDTO) -> list[str]:
        return self._actions


@pytest.fixture
def override_permission_service(app):
    def _override(service: MockPermissionsService):
        async def _get_service():
            return service

        app.dependency_overrides[get_permission_service] = _get_service

    return _override


@pytest.fixture
def mock_permission_crud():
    crud = Mock(spec=PermissionCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.count_roles = AsyncMock()
    crud.create = AsyncMock()
    crud.delete = AsyncMock()
    crud.delete_entity_permissions = AsyncMock()
    crud.get_all_roles = AsyncMock()
    crud.get_users_by_role = AsyncMock()
    crud.get_api_policies_by_role = AsyncMock()
    return crud


@pytest.fixture
def mock_permission_service(
    mock_permission_crud,
    mock_audit_log_handler,
    mock_revision_handler,
    mock_user_service,
    mock_casbin,
):
    return PermissionService(
        user_service=mock_user_service,
        revision_handler=mock_revision_handler,
        crud=mock_permission_crud,
        audit_log_handler=mock_audit_log_handler,
        casbin_enforcer=mock_casbin,
    )


@pytest.fixture
def mocked_permission_response():
    return PermissionResponse(id=uuid4(), ptype="p", v0="local", v1="permission1", v2="read")


@pytest.fixture
def mocked_role_permission(mocked_user):
    return Permission(
        id=uuid4(),
        v1="role_name",
        ptype="g",
        v0=f"user:{mocked_user.id}",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        creator=mocked_user,
    )


@pytest.fixture
def mocked_policy_permission(mocked_user):
    return Permission(
        id=uuid4(),
        v0="role_name",
        ptype="p",
        v1=f"resource:{uuid4()}",
        created_at=datetime.now(),
        updated_at=datetime.now(),
        creator=mocked_user,
    )


@pytest.fixture
def mock_role_data() -> dict[str, Any]:
    return PermissionResponse(id=uuid4(), ptype="g", v0="role:admin", v1="admin_role").model_dump(by_alias=True)


@pytest.fixture
def mock_policy_data() -> dict[str, Any]:
    return PermissionResponse(id=uuid4(), ptype="p", v0="admin_role", v1="api:users", v2="read").model_dump(
        by_alias=True
    )
