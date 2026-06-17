from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from graphql_api.schema import schema

CREATE_USER_MUTATION = """
    mutation CreateUser($input: UserCreateInput!) {
        createUser(input: $input) {
            id
            identifier
        }
    }
"""

LINK_USER_ACCOUNT_MUTATION = """
    mutation LinkUserAccount($primaryUserId: UUID!, $secondaryUserId: UUID!) {
        linkUserAccount(primaryUserId: $primaryUserId, secondaryUserId: $secondaryUserId) {
            id
            identifier
        }
    }
"""

UNLINK_USER_ACCOUNT_MUTATION = """
    mutation UnlinkUserAccount($primaryUserId: UUID!, $secondaryUserId: UUID!) {
        unlinkUserAccount(primaryUserId: $primaryUserId, secondaryUserId: $secondaryUserId) {
            id
            identifier
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestCreateUserMutation:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_create_user_returns_created_user(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_user_service,
        mocked_user,
        mocked_user_response,
    ):
        mock_is_super_admin.return_value = True
        mock_user_service.create_user = AsyncMock(return_value=mocked_user)
        mock_get_service.return_value = mock_user_service

        result = await schema.execute(
            CREATE_USER_MUTATION,
            variable_values={
                "input": {
                    "identifier": "service-account",
                    "description": "A service account",
                    "password": "supersecret",
                }
            },
            context_value=make_context(mocked_user_response),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createUser"] == {
            "id": str(mocked_user.id),
            "identifier": mocked_user.identifier,
        }
        mock_user_service.create_user.assert_awaited_once()
        assert mock_user_service.create_user.await_args is not None
        assert mock_user_service.create_user.await_args.kwargs["requester"] == mocked_user_response

    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_create_user_denies_non_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_user_service,
        mocked_user_response,
    ):
        mock_is_super_admin.return_value = False
        mock_user_service.create_user = AsyncMock()
        mock_get_service.return_value = mock_user_service

        result = await schema.execute(
            CREATE_USER_MUTATION,
            variable_values={
                "input": {
                    "identifier": "service-account",
                    "description": "A service account",
                    "password": "supersecret",
                }
            },
            context_value=make_context(mocked_user_response),
        )

        assert result.data is None or result.data["createUser"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_user_service.create_user.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_create_user_requires_authentication(
        self,
        mock_get_service,
        mock_user_service,
    ):
        mock_user_service.create_user = AsyncMock()
        mock_get_service.return_value = mock_user_service

        request = Mock()
        request.state = SimpleNamespace(user=None)

        result = await schema.execute(
            CREATE_USER_MUTATION,
            variable_values={
                "input": {
                    "identifier": "service-account",
                    "description": "A service account",
                    "password": "supersecret",
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createUser"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_user_service.create_user.assert_not_awaited()


class TestLinkUserAccountMutation:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_link_user_account_returns_user(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_user_service,
        mocked_user,
        mocked_user_response,
    ):
        mock_is_super_admin.return_value = True
        mock_user_service.link_accounts = AsyncMock(return_value=mocked_user)
        mock_get_service.return_value = mock_user_service

        primary_id = uuid4()
        secondary_id = uuid4()

        result = await schema.execute(
            LINK_USER_ACCOUNT_MUTATION,
            variable_values={
                "primaryUserId": str(primary_id),
                "secondaryUserId": str(secondary_id),
            },
            context_value=make_context(mocked_user_response),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["linkUserAccount"]["id"] == str(mocked_user.id)
        mock_user_service.link_accounts.assert_awaited_once_with(
            primary_user_id=primary_id, secondary_user_id=secondary_id, requester=mocked_user_response
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_link_user_account_denies_non_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_user_service,
        mocked_user_response,
    ):
        mock_is_super_admin.return_value = False
        mock_user_service.link_accounts = AsyncMock()
        mock_get_service.return_value = mock_user_service

        result = await schema.execute(
            LINK_USER_ACCOUNT_MUTATION,
            variable_values={
                "primaryUserId": str(uuid4()),
                "secondaryUserId": str(uuid4()),
            },
            context_value=make_context(mocked_user_response),
        )

        assert result.data is None or result.data["linkUserAccount"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_user_service.link_accounts.assert_not_awaited()


class TestUnlinkUserAccountMutation:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_unlink_user_account_returns_user(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_user_service,
        mocked_user,
        mocked_user_response,
    ):
        mock_is_super_admin.return_value = True
        mock_user_service.unlink_accounts = AsyncMock(return_value=mocked_user)
        mock_get_service.return_value = mock_user_service

        primary_id = uuid4()
        secondary_id = uuid4()

        result = await schema.execute(
            UNLINK_USER_ACCOUNT_MUTATION,
            variable_values={
                "primaryUserId": str(primary_id),
                "secondaryUserId": str(secondary_id),
            },
            context_value=make_context(mocked_user_response),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["unlinkUserAccount"]["id"] == str(mocked_user.id)
        mock_user_service.unlink_accounts.assert_awaited_once_with(
            primary_user_id=primary_id, secondary_user_id=secondary_id, requester=mocked_user_response
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.user.mutations.user_is_super_admin", new_callable=AsyncMock)
    @patch("graphql_api.modules.user.mutations.get_user_service")
    async def test_unlink_user_account_denies_non_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_user_service,
        mocked_user_response,
    ):
        mock_is_super_admin.return_value = False
        mock_user_service.unlink_accounts = AsyncMock()
        mock_get_service.return_value = mock_user_service

        result = await schema.execute(
            UNLINK_USER_ACCOUNT_MUTATION,
            variable_values={
                "primaryUserId": str(uuid4()),
                "secondaryUserId": str(uuid4()),
            },
            context_value=make_context(mocked_user_response),
        )

        assert result.data is None or result.data["unlinkUserAccount"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_user_service.unlink_accounts.assert_not_awaited()
