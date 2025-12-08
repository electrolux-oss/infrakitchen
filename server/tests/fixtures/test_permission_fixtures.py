from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from core.permissions.crud import PermissionCRUD
from core.permissions.model import Permission
from core.permissions.schema import PermissionResponse
from core.permissions.service import PermissionService


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
