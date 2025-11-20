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
    crud.get_one = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete_resource_permissions = AsyncMock()
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
def permission_response():
    return PermissionResponse(id=uuid4(), ptype="p", v0="local", v1="permission1", v2="read")


@pytest.fixture
def permission():
    return Permission(id=uuid4(), identifier="permission1", provider="local")
