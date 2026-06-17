from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from graphql_api.schema import schema

CREATE_AUTH_PROVIDER_MUTATION = """
    mutation CreateAuthProvider($input: AuthProviderCreateInput!) {
        createAuthProvider(input: $input) {
            id
            name
        }
    }
"""

UPDATE_AUTH_PROVIDER_MUTATION = """
    mutation UpdateAuthProvider($id: UUID!, $input: AuthProviderUpdateInput!) {
        updateAuthProvider(id: $id, input: $input) {
            id
            name
        }
    }
"""

DELETE_AUTH_PROVIDER_MUTATION = """
    mutation DeleteAuthProvider($id: UUID!) {
        deleteAuthProvider(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestAuthProviderMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth_provider.mutations.user_is_super_admin")
    @patch("graphql_api.modules.auth_provider.mutations.get_auth_provider_service")
    async def test_create_auth_provider_returns_created(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_auth_provider_service,
        auth_provider,
        mocked_user,
    ):
        mock_is_super_admin.return_value = True
        mock_auth_provider_service.create_auth_provider = AsyncMock(return_value=auth_provider)
        mock_get_service.return_value = mock_auth_provider_service

        result = await schema.execute(
            CREATE_AUTH_PROVIDER_MUTATION,
            variable_values={
                "input": {
                    "name": "Test Provider",
                    "authProvider": "microsoft",
                    "configuration": {
                        "auth_provider": "microsoft",
                        "client_id": "test",
                        "client_secret": "secret",
                        "tenant_id": "tenant",
                        "redirect_uri": "http://localhost",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createAuthProvider"]["id"] == str(auth_provider.id)
        mock_auth_provider_service.create_auth_provider.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth_provider.mutations.user_is_super_admin")
    @patch("graphql_api.modules.auth_provider.mutations.get_auth_provider_service")
    async def test_create_auth_provider_denies_non_super_admin(
        self,
        mock_get_service,
        mock_is_super_admin,
        mock_auth_provider_service,
        mocked_user,
    ):
        mock_is_super_admin.return_value = False
        mock_auth_provider_service.create_auth_provider = AsyncMock()
        mock_get_service.return_value = mock_auth_provider_service

        result = await schema.execute(
            CREATE_AUTH_PROVIDER_MUTATION,
            variable_values={
                "input": {
                    "name": "Test Provider",
                    "authProvider": "guest",
                    "configuration": {"auth_provider": "guest"},
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["createAuthProvider"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_auth_provider_service.create_auth_provider.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth_provider.mutations.get_auth_provider_service")
    async def test_update_auth_provider_returns_updated(
        self,
        mock_get_service,
        mock_auth_provider_service,
        auth_provider,
        mocked_user,
    ):
        mock_auth_provider_service.get_actions = AsyncMock(return_value=["edit"])
        mock_auth_provider_service.update_auth_provider = AsyncMock(return_value=auth_provider)
        mock_get_service.return_value = mock_auth_provider_service

        result = await schema.execute(
            UPDATE_AUTH_PROVIDER_MUTATION,
            variable_values={
                "id": str(auth_provider.id),
                "input": {"name": "Updated Provider"},
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateAuthProvider"]["id"] == str(auth_provider.id)
        mock_auth_provider_service.get_actions.assert_awaited_once_with(
            auth_provider_id=auth_provider.id, requester=mocked_user
        )
        mock_auth_provider_service.update_auth_provider.assert_awaited_once()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth_provider.mutations.get_auth_provider_service")
    async def test_update_auth_provider_denies_without_edit_action(
        self,
        mock_get_service,
        mock_auth_provider_service,
        mocked_user,
    ):
        auth_provider_id = uuid4()
        mock_auth_provider_service.get_actions = AsyncMock(return_value=[])
        mock_auth_provider_service.update_auth_provider = AsyncMock()
        mock_get_service.return_value = mock_auth_provider_service

        result = await schema.execute(
            UPDATE_AUTH_PROVIDER_MUTATION,
            variable_values={
                "id": str(auth_provider_id),
                "input": {"name": "Updated Provider"},
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateAuthProvider"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_auth_provider_service.update_auth_provider.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth_provider.mutations.get_auth_provider_service")
    async def test_delete_auth_provider_returns_true(
        self,
        mock_get_service,
        mock_auth_provider_service,
        auth_provider,
        mocked_user,
    ):
        mock_auth_provider_service.get_actions = AsyncMock(return_value=["delete"])
        mock_auth_provider_service.delete = AsyncMock()
        mock_get_service.return_value = mock_auth_provider_service

        result = await schema.execute(
            DELETE_AUTH_PROVIDER_MUTATION,
            variable_values={"id": str(auth_provider.id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteAuthProvider": True}
        mock_auth_provider_service.get_actions.assert_awaited_once_with(
            auth_provider_id=auth_provider.id, requester=mocked_user
        )
        mock_auth_provider_service.delete.assert_awaited_once_with(
            auth_provider_id=str(auth_provider.id), requester=mocked_user
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.auth_provider.mutations.get_auth_provider_service")
    async def test_delete_auth_provider_denies_without_delete_action(
        self,
        mock_get_service,
        mock_auth_provider_service,
        mocked_user,
    ):
        auth_provider_id = uuid4()
        mock_auth_provider_service.get_actions = AsyncMock(return_value=[])
        mock_auth_provider_service.delete = AsyncMock()
        mock_get_service.return_value = mock_auth_provider_service

        result = await schema.execute(
            DELETE_AUTH_PROVIDER_MUTATION,
            variable_values={"id": str(auth_provider_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteAuthProvider"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_auth_provider_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_create_auth_provider_requires_auth(self):
        result = await schema.execute(
            CREATE_AUTH_PROVIDER_MUTATION,
            variable_values={
                "input": {
                    "name": "Test",
                    "authProvider": "guest",
                    "configuration": {"auth_provider": "guest"},
                }
            },
            context_value={"session": Mock(), "user": None, "request": Mock()},
        )

        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
