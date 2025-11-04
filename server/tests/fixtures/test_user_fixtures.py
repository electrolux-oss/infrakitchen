from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from core.users.crud import UserCRUD
from core.users.model import User, UserDTO
from core.users.schema import UserResponse
from core.users.service import UserService


@pytest.fixture
def mock_user_crud():
    crud = Mock(spec=UserCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.get_one = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.refresh = AsyncMock()
    return crud


@pytest.fixture
def mock_user_service(
    mock_user_crud,
    mock_audit_log_handler,
):
    return UserService(
        crud=mock_user_crud,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def mocked_user_response():
    return UserResponse(
        id=uuid4(),
        identifier="user1",
        provider="local",
        primary_account=[],
        secondary_accounts=[],
    )


@pytest.fixture
def mocked_user():
    return User(
        id=uuid4(),
        identifier="user1",
        provider="local",
        primary_account=[],
        secondary_accounts=[],
        deactivated=False,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def mock_user_dto(mocked_user):
    user = UserDTO.model_validate(mocked_user)
    return user


@pytest.fixture
def mock_user_has_access_to_resource(monkeypatch):
    def _set_access(result: bool, module):
        async def _mock(user, resource_id, action):
            return result

        monkeypatch.setattr(module, "user_has_access_to_resource", _mock)
        return _mock

    return _set_access


@pytest.fixture
def mock_user_permissions():
    def _set_permissions(permission_value, monkeypatch, module_path):
        mock_permissions = AsyncMock(return_value=permission_value)
        monkeypatch.setattr(module_path, mock_permissions)
        return mock_permissions

    return _set_permissions
