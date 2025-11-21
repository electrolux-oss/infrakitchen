import pytest
from unittest.mock import Mock

from pydantic import PydanticUserError
from uuid import uuid4
from core.users.schema import UserShort

ROLE_NAME = "test_role"


class TestGetUsersByRole:
    @pytest.mark.asyncio
    async def test_get_users_by_role_success(
        self, mock_permission_service, mock_permission_crud, monkeypatch, mocked_user
    ):
        user_short = UserShort(id=uuid4(), identifier="user1", provider="local")

        mock_permission_crud.get_users_by_role.return_value = [mocked_user]
        mocked_validate = Mock(return_value=user_short)
        monkeypatch.setattr(UserShort, "model_validate", mocked_validate)

        result = await mock_permission_service.get_users_by_role(ROLE_NAME)

        assert len(result) == 1

        mock_permission_crud.get_users_by_role.assert_awaited_once_with(ROLE_NAME)
        mocked_validate.assert_called_once_with(mocked_user)

    @pytest.mark.asyncio
    async def test_get_users_by_role_error(
        self, mock_permission_service, mock_permission_crud, monkeypatch, mocked_user
    ):
        mock_permission_crud.get_users_by_role.return_value = [mocked_user]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(UserShort, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_permission_service.get_users_by_role(ROLE_NAME)

        assert exc.value is error
        mock_permission_crud.get_users_by_role.assert_awaited_once_with(ROLE_NAME)
