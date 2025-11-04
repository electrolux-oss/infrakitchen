from datetime import datetime
import pytest
from unittest.mock import Mock

from pydantic import PydanticUserError
from uuid import uuid4

from core.errors import EntityNotFound
from core.users.model import User
from core.users.schema import UserResponse, UserCreate, UserUpdate
from core.users.service import UserService
from core import UserDTO

USER_ID = "abc123"


@pytest.fixture
def mock_user_service(
    mock_user_crud,
    mock_audit_log_handler,
):
    return UserService(
        crud=mock_user_crud,
        audit_log_handler=mock_audit_log_handler,
    )


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_user_service, mock_user_crud):
        mock_user_crud.get_by_id.return_value = None

        result = await mock_user_service.get_by_id("invalid_id")

        assert result is None
        mock_user_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_user_service, mock_user_crud, monkeypatch, mocked_user, mocked_user_response
    ):
        mock_user_crud.get_by_id.return_value = mocked_user
        mocked_validate = Mock(return_value=mocked_user_response)
        monkeypatch.setattr(UserResponse, "model_validate", mocked_validate)

        result = await mock_user_service.get_by_id(USER_ID)

        assert result.identifier == mocked_user.identifier

        mock_user_crud.get_by_id.assert_awaited_once_with(USER_ID)
        mocked_validate.assert_called_once_with(mocked_user)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_user_service, mock_user_crud, monkeypatch, mocked_user):
        mock_user_crud.get_by_id.return_value = mocked_user

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(UserResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_user_service.get_by_id(USER_ID)

        assert exc.value is error
        mock_user_crud.get_by_id.assert_awaited_once_with(USER_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_user_service, mock_user_crud):
        mock_user_crud.get_all.return_value = []

        result = await mock_user_service.get_all(limit=10)

        assert result == []
        mock_user_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_user_service,
        mock_user_crud,
        monkeypatch,
        mocked_user,
    ):
        user1 = mocked_user
        user2 = mocked_user
        user2.id = uuid4()
        users = [user1, user2]
        mock_user_crud.get_all.return_value = users

        user_response_1 = UserResponse(
            id=user1.id,
            identifier=user1.identifier,
            provider=user1.provider,
        )
        user_response_2 = UserResponse(
            id=user2.id,
            identifier=user2.identifier,
            provider=user2.provider,
        )

        def mock_model_validate_validate(arg):
            return user_response_1 if arg.id == user1.id else user_response_2

        monkeypatch.setattr(UserResponse, "model_validate", mock_model_validate_validate)

        result = await mock_user_service.get_all(limit=10, offset=0)

        assert result[0].identifier == user1.identifier
        assert result[1].identifier == user2.identifier
        mock_user_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_user_service, mock_user_crud, monkeypatch, mocked_user):
        mock_user_crud.get_all.return_value = [mocked_user]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(UserResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_user_service.get_all(limit=10)

        assert exc.value is error
        mock_user_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_user_service, mock_user_crud):
        mock_user_crud.count.return_value = 1

        result = await mock_user_service.count(filter={"key": "value"})

        assert result == 1

        mock_user_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_user_service, mock_user_crud):
        error = RuntimeError("db failure")
        mock_user_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_user_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_user_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_user_service,
        mock_user_crud,
        mock_audit_log_handler,
        monkeypatch,
        mocked_user,
        mocked_user_response,
    ):
        # Only ik_service_account provider is allowed to be created
        user_body = {
            "identifier": "test_user",
            "password": "password123",
        }
        user_create = UserCreate.model_validate(user_body)
        expected_user_body = user_create.model_dump(exclude_unset=True)
        expected_user_body["created_by"] = "user1"

        requester = Mock(spec=UserDTO)
        requester.id = "user1"

        new_user = User(
            id=uuid4(),
            identifier="test_user",
            provider="ik_service_account",
            created_at=datetime.now(),
            updated_at=datetime.now(),
            deactivated=False,
        )
        mock_user_crud.create.return_value = new_user
        mock_user_crud.get_by_id.return_value = new_user

        # monkeypatch.setattr(UserResponse, "model_validate", Mock(return_value=mocked_user_response))

        result = await mock_user_service.create(user_create, requester)

        # mock_user_crud.create.assert_awaited_once_with(expected_user_body)

        mock_audit_log_handler.create_log.assert_awaited_once_with(new_user.id, requester.id, "create")

        assert result.id == new_user.id
        assert result.identifier == new_user.identifier
        assert result.provider == "ik_service_account"
        assert hasattr(result, "password") is False  # Password should not be in the response

    @pytest.mark.asyncio
    async def test_create_error(self, mock_user_service, mock_user_crud):
        user_body = {
            "identifier": "test_user",
            "password": "password123",
        }

        user_create = UserCreate.model_validate(user_body)

        requester = Mock(spec=UserDTO)
        requester.id = "user1"

        error = RuntimeError("create fail")
        mock_user_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_user_service.create(user_create, requester)

        assert exc.value is error
        mock_user_crud.create.assert_awaited_once()


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_user_service,
        mock_user_crud,
        mock_audit_log_handler,
        monkeypatch,
        mocked_user,
        mocked_user_response,
    ):
        user_update = Mock(spec=UserUpdate)
        user_update_body = {"identifier": "test_user", "description": "User description Updated"}
        user_id = uuid4()
        existing_user = mocked_user

        updated_user = User(
            id=user_id,
            identifier="test_user",
            description="User description Updated",
        )
        user_response_with_update = mocked_user_response
        user_response_with_update.id = user_id
        user_response_with_update.description = "User description Updated"

        user_update.model_dump = Mock(return_value=user_update_body)
        mock_user_crud.get_by_id.return_value = existing_user
        mock_user_crud.update.return_value = updated_user
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(UserResponse, "model_validate", Mock(return_value=user_response_with_update))

        result = await mock_user_service.update(user_id=USER_ID, user=user_update, requester=requester)

        user_update.model_dump.assert_called_once_with(exclude_unset=True)
        mock_user_crud.get_by_id.assert_awaited_once_with(USER_ID)
        mock_user_crud.update.assert_awaited_once_with(existing_user, user_update_body)

        mock_audit_log_handler.create_log.assert_awaited_once_with(updated_user.id, requester.id, "update")

        assert result.id == updated_user.id
        assert result.description == updated_user.description

    @pytest.mark.asyncio
    async def test_update_user_does_not_exist(self, mock_user_service, mock_user_crud):
        user_update = Mock(spec=UserUpdate)
        requester = Mock(spec=UserDTO)

        mock_user_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound) as exc:
            await mock_user_service.update(user_id=USER_ID, user=user_update, requester=requester)

        assert str(exc.value) == "User not found"

    @pytest.mark.asyncio
    async def test_update_error(self, mock_user_service, mock_user_crud):
        user_update = Mock(spec=UserUpdate)
        requester = Mock(spec=UserDTO)
        existing_user = User(id=uuid4(), identifier="Test User")
        mock_user_crud.get_by_id.return_value = existing_user

        error = RuntimeError("update fail")
        mock_user_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_user_service.update(user_id=USER_ID, user=user_update, requester=requester)

        assert exc.value is error


class TestLinkUserAccount:
    @pytest.mark.asyncio
    async def test_link_user_account_success_new_link(
        self, mock_user_service, mock_user_crud, mock_audit_log_handler, mock_user_dto
    ):
        """Test successful linking of two users where no prior links exist."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(
            id=primary_id,
            identifier="primary_user",
            provider="test_provider",
            is_primary=False,
            primary_account=[],
            secondary_accounts=[],
            deactivated=False,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        mock_secondary_user = User(
            id=secondary_id,
            identifier="secondary_user",
            provider="test_provider",
            is_primary=False,
            primary_account=[],
            secondary_accounts=[],
            deactivated=False,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        result = await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)

        assert result.id == primary_id
        assert result.provider == "test_provider"

        assert mock_user_crud.get_by_id.await_count == 2

        mock_user_crud.update.assert_awaited_once_with(
            mock_primary_user,
            {"secondary_accounts": [secondary_id], "is_primary": True},
        )
        mock_user_crud.refresh.assert_awaited_once_with(mock_primary_user)
        mock_audit_log_handler.create_log.assert_awaited_once_with(primary_id, mock_user_dto.id, "link_accounts")

    @pytest.mark.asyncio
    async def test_link_user_account_success_existing_secondary(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test successful linking when primary user already has other secondary accounts."""
        primary_id = uuid4()
        existing_secondary_id = uuid4()
        new_secondary_id = uuid4()

        existing_secondary_user = User(
            id=existing_secondary_id,
            identifier="existing_sec",
            provider="p",
            deactivated=False,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        mock_primary_user = User(
            id=primary_id,
            identifier="primary",
            provider="p",
            secondary_accounts=[existing_secondary_user],
            is_primary=True,
            deactivated=False,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        mock_new_secondary_user = User(id=new_secondary_id, identifier="new_sec", provider="p")

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_new_secondary_user]

        result = await mock_user_service.link_accounts(primary_id, new_secondary_id, mock_user_dto)

        assert result.id == primary_id
        assert result.provider == "p"

        mock_user_crud.update.assert_awaited_once_with(
            mock_primary_user,
            {"secondary_accounts": [existing_secondary_id, new_secondary_id], "is_primary": True},
        )
        mock_user_crud.refresh.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_link_user_account_primary_not_found(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if primary user is not found."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_user_crud.get_by_id.side_effect = [None, User(id=secondary_id)]  # Primary not found

        with pytest.raises(EntityNotFound) as exc_info:
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        assert str(exc_info.value) == "User not found"
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_secondary_not_found(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if secondary user is not found."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_user_crud.get_by_id.side_effect = [User(id=primary_id), None]  # Secondary not found

        with pytest.raises(EntityNotFound) as exc_info:
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        assert str(exc_info.value) == "User not found"
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_self_link(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if attempting to link a user to themselves."""
        user_id = uuid4()
        mock_user = User(id=user_id, identifier="self_user", provider="p")

        mock_user_crud.get_by_id.side_effect = [mock_user, mock_user]  # Both calls return same user

        with pytest.raises(ValueError, match="Cannot link a user to themselves"):
            await mock_user_service.link_accounts(user_id, user_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_primary_deactivated(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if primary user is deactivated."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(id=primary_id, deactivated=True)
        mock_secondary_user = User(id=secondary_id)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Cannot link deactivated accounts"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_secondary_deactivated(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if secondary user is deactivated."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(id=primary_id)
        mock_secondary_user = User(id=secondary_id, deactivated=True)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Cannot link deactivated accounts"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_secondary_is_primary(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if the secondary user is already marked as a primary."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(id=primary_id)
        mock_secondary_user = User(id=secondary_id, is_primary=True)  # Secondary is already primary

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Cannot link a primary user as a secondary account"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_secondary_already_has_primary(
        self, mock_user_service, mock_user_crud, mock_user_dto
    ):
        """Test linking fails if secondary user already has a primary account."""
        primary_id = uuid4()
        secondary_id = uuid4()
        existing_linked_primary_id = uuid4()

        mock_primary_user = User(id=primary_id)
        # Secondary user is already linked to another primary
        mock_secondary_user = User(id=secondary_id, primary_account=[User(id=existing_linked_primary_id)])

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Secondary user already has a primary account"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_primary_is_already_secondary(
        self, mock_user_service, mock_user_crud, mock_user_dto
    ):
        """Test linking fails if the primary user is already a secondary account for someone else."""
        primary_id = uuid4()
        secondary_id = uuid4()
        another_primary_id = uuid4()

        # Primary user is already linked as a secondary to another account
        mock_primary_user = User(id=primary_id, primary_account=[User(id=another_primary_id)])
        mock_secondary_user = User(id=secondary_id)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Secondary user cannot be linked as primary"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_user_account_already_linked(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if accounts are already linked."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_secondary_user = User(id=secondary_id, identifier="sec", provider="p")
        # Primary user already has this secondary account linked
        mock_primary_user = User(
            id=primary_id, identifier="prim", provider="p", secondary_accounts=[mock_secondary_user]
        )

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Secondary user already has a primary account"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_link_service_account(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test linking fails if primary user is deactivated."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(id=primary_id, deactivated=True, provider="ik_service_account")
        mock_secondary_user = User(id=secondary_id)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Cannot link 'ik_service_account' users"):
            await mock_user_service.link_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()


class TestUnlinkUserAccount:
    @pytest.mark.asyncio
    async def test_unlink_accounts_success_single_secondary(
        self,
        mock_user_service,
        mock_user_crud,
        mock_audit_log_handler,
        mock_user_dto,
        monkeypatch,
        mocked_user_response,
    ):
        """Test successful unlinking where primary user has only one secondary."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_secondary_user = User(id=secondary_id, is_primary=False, primary_account=[], secondary_accounts=[])
        mock_primary_user = User(id=primary_id, is_primary=True, secondary_accounts=[mock_secondary_user])
        mock_secondary_user.primary_account.append(mock_primary_user)  # Link back for secondary user

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]
        mocked_validate = Mock(return_value=mocked_user_response)
        monkeypatch.setattr(
            UserResponse,
            "model_validate",
            mocked_validate,
        )

        await mock_user_service.unlink_accounts(primary_id, secondary_id, mock_user_dto)

        mock_user_crud.get_by_id.assert_any_call(primary_id)
        mock_user_crud.get_by_id.assert_any_call(secondary_id)
        assert mock_user_crud.get_by_id.await_count == 2

        # Assert update for primary user
        mock_user_crud.update.assert_any_call(
            mock_primary_user,
            {"secondary_accounts": [], "is_primary": False},
        )
        # Assert update for secondary user
        mock_user_crud.update.assert_any_call(
            mock_secondary_user,
            {"primary_account": [], "is_primary": False},
        )
        assert mock_user_crud.update.await_count == 2

        mock_user_crud.refresh.assert_any_call(mock_primary_user)
        mock_user_crud.refresh.assert_any_call(mock_secondary_user)
        assert mock_user_crud.refresh.await_count == 2

        mock_audit_log_handler.create_log.assert_any_call(primary_id, mock_user_dto.id, "unlink_accounts")
        mock_audit_log_handler.create_log.assert_any_call(secondary_id, mock_user_dto.id, "unlink_accounts")
        assert mock_audit_log_handler.create_log.await_count == 2

    @pytest.mark.asyncio
    async def test_unlink_accounts_success_multiple_secondaries(
        self,
        mock_user_service,
        mock_user_crud,
        mock_audit_log_handler,
        mock_user_dto,
        monkeypatch,
        mocked_user_response,
    ):
        """Test successful unlinking where primary user has multiple secondaries."""
        primary_id = uuid4()
        secondary_id_to_unlink = uuid4()
        other_secondary_id = uuid4()

        mock_secondary_to_unlink = User(id=secondary_id_to_unlink)
        mock_other_secondary = User(id=other_secondary_id)

        mock_primary_user = User(
            id=primary_id, is_primary=True, secondary_accounts=[mock_secondary_to_unlink, mock_other_secondary]
        )
        mock_secondary_to_unlink.primary_account.append(mock_primary_user)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_to_unlink]
        mocked_validate = Mock(return_value=mocked_user_response)
        monkeypatch.setattr(
            UserResponse,
            "model_validate",
            mocked_validate,
        )

        await mock_user_service.unlink_accounts(primary_id, secondary_id_to_unlink, mock_user_dto)

        mock_user_crud.update.assert_any_call(
            mock_primary_user,
            {"secondary_accounts": [other_secondary_id], "is_primary": True},
        )
        mock_user_crud.update.assert_any_call(
            mock_secondary_to_unlink,
            {"primary_account": [], "is_primary": False},
        )
        assert mock_user_crud.update.await_count == 2

        mock_audit_log_handler.create_log.assert_any_call(primary_id, mock_user_dto.id, "unlink_accounts")
        mock_audit_log_handler.create_log.assert_any_call(secondary_id_to_unlink, mock_user_dto.id, "unlink_accounts")

    @pytest.mark.asyncio
    async def test_unlink_accounts_primary_not_found(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test unlinking fails if primary user is not found."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_user_crud.get_by_id.side_effect = [None, User(id=secondary_id)]

        with pytest.raises(EntityNotFound) as exc_info:
            await mock_user_service.unlink_accounts(primary_id, secondary_id, mock_user_dto)
        assert str(exc_info.value) == "User not found"
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unlink_accounts_secondary_not_found(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test unlinking fails if secondary user is not found."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_user_crud.get_by_id.side_effect = [User(id=primary_id), None]

        with pytest.raises(EntityNotFound) as exc_info:
            await mock_user_service.unlink_accounts(primary_id, secondary_id, mock_user_dto)
        assert str(exc_info.value) == "User not found"
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unlink_accounts_self_unlink(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test unlinking fails if attempting to unlink a user from themselves."""
        user_id = uuid4()
        mock_user = User(id=user_id)

        mock_user_crud.get_by_id.side_effect = [mock_user, mock_user]

        with pytest.raises(ValueError, match="Cannot unlink a user from themselves"):
            await mock_user_service.unlink_accounts(user_id, user_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unlink_accounts_primary_not_primary_account(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test unlinking fails if the primary user is not marked as a primary account."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(id=primary_id, is_primary=False)  # Not a primary
        mock_secondary_user = User(id=secondary_id)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Primary user must be a primary account"):
            await mock_user_service.unlink_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_unlink_accounts_not_linked(self, mock_user_service, mock_user_crud, mock_user_dto):
        """Test unlinking fails if the accounts are not actually linked."""
        primary_id = uuid4()
        secondary_id = uuid4()

        mock_primary_user = User(id=primary_id, is_primary=True, secondary_accounts=[])  # No secondary accounts
        mock_secondary_user = User(id=secondary_id)

        mock_user_crud.get_by_id.side_effect = [mock_primary_user, mock_secondary_user]

        with pytest.raises(ValueError, match="Secondary user is not linked to the primary user"):
            await mock_user_service.unlink_accounts(primary_id, secondary_id, mock_user_dto)
        mock_user_crud.update.assert_not_awaited()
