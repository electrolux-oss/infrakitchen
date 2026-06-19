from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.secrets.schema import SecretValidationResponse
from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_SECRET_MUTATION = """
    mutation CreateSecret($input: SecretCreateInput!) {
        createSecret(input: $input) {
            id
            name
            secretType
            secretProvider
            entityName
        }
    }
"""

UPDATE_SECRET_MUTATION = """
    mutation UpdateSecret($id: UUID!, $input: SecretUpdateInput!) {
        updateSecret(id: $id, input: $input) {
            id
            name
            description
            entityName
        }
    }
"""

SECRET_ACTION_MUTATION = """
    mutation SecretAction($id: UUID!, $input: SecretActionInput!) {
        secretAction(id: $id, input: $input) {
            id
            name
            status
            entityName
        }
    }
"""

DELETE_SECRET_MUTATION = """
    mutation DeleteSecret($id: UUID!) {
        deleteSecret(id: $id)
    }
"""


VALIDATE_SECRET_MUTATION = """
    mutation ValidateSecret($id: UUID!) {
        validateSecret(id: $id) {
            isValid
            message
        }
    }
"""

VALIDATE_SECRET_CONFIG_MUTATION = """
    mutation ValidateSecretConfig($input: SecretCreateInput!) {
        validateSecretConfig(input: $input) {
            isValid
            message
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestSecretMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_create_secret_returns_created_secret(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_secret,
        mocked_user,
    ):
        mock_secret_service.create_secret = AsyncMock(return_value=mocked_secret)
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            CREATE_SECRET_MUTATION,
            variable_values={
                "input": {
                    "name": "TestSecret",
                    "secretType": "tofu",
                    "secretProvider": "aws",
                    "integrationId": str(mocked_secret.integration_id),
                    "configuration": {
                        "name": "test-secret",
                        "aws_region": "us-west-2",
                        "secret_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createSecret"] == {
            "id": str(mocked_secret.id),
            "name": mocked_secret.name,
            "secretType": mocked_secret.secret_type,
            "secretProvider": mocked_secret.secret_provider,
            "entityName": "secret",
        }
        mock_secret_service.create_secret.assert_awaited_once_with(secret=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_create_secret_requires_authentication(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_secret,
        mocked_user,
    ):
        mock_secret_service.create_secret = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_SECRET_MUTATION,
            variable_values={
                "input": {
                    "name": "TestSecret",
                    "secretType": "tofu",
                    "secretProvider": "aws",
                    "integrationId": str(mocked_secret.integration_id),
                    "configuration": {
                        "name": "test-secret",
                        "aws_region": "us-west-2",
                        "secret_provider": "aws",
                    },
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createSecret"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_secret_service.create_secret.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_update_secret_denies_without_edit_action(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock(return_value=[])
        mock_secret_service.update_secret = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            UPDATE_SECRET_MUTATION,
            variable_values={
                "id": str(secret_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateSecret"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_secret_service.get_actions.assert_awaited_once_with(secret_id=secret_id, requester=mocked_user)
        mock_secret_service.update_secret.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_update_secret_returns_updated_secret(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_secret,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_secret_service.update_secret = AsyncMock(return_value=mocked_secret)
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            UPDATE_SECRET_MUTATION,
            variable_values={
                "id": str(secret_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateSecret"] == {
            "id": str(mocked_secret.id),
            "name": mocked_secret.name,
            "description": mocked_secret.description,
            "entityName": "secret",
        }
        mock_secret_service.get_actions.assert_awaited_once_with(secret_id=secret_id, requester=mocked_user)
        mock_secret_service.update_secret.assert_awaited_once_with(
            secret_id=str(secret_id),
            secret=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_secret_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock()
        mock_secret_service.patch_action_secret = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            SECRET_ACTION_MUTATION,
            variable_values={
                "id": str(secret_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["secretAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_secret_service.get_actions.assert_not_awaited()
        mock_secret_service.patch_action_secret.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_secret_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock(return_value=[])
        mock_secret_service.patch_action_secret = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            SECRET_ACTION_MUTATION,
            variable_values={
                "id": str(secret_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["secretAction"] is None
        assert result.errors is not None
        assert any("Access denied for action disable" in error.message for error in result.errors)
        mock_secret_service.get_actions.assert_awaited_once_with(secret_id=secret_id, requester=mocked_user)
        mock_secret_service.patch_action_secret.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_secret_action_returns_updated_secret(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_secret,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock(return_value=[ModelActions.DISABLE.value])
        mock_secret_service.patch_action_secret = AsyncMock(return_value=mocked_secret)
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            SECRET_ACTION_MUTATION,
            variable_values={
                "id": str(secret_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["secretAction"]["id"] == str(mocked_secret.id)
        assert result.data["secretAction"]["name"] == mocked_secret.name
        assert result.data["secretAction"]["status"] is not None
        mock_secret_service.get_actions.assert_awaited_once_with(secret_id=secret_id, requester=mocked_user)
        mock_secret_service.patch_action_secret.assert_awaited_once()
        assert mock_secret_service.patch_action_secret.await_args
        call_kwargs = mock_secret_service.patch_action_secret.await_args.kwargs
        assert call_kwargs["secret_id"] == str(secret_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.DISABLE.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_delete_secret_denies_without_delete_action(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock(return_value=[])
        mock_secret_service.delete = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            DELETE_SECRET_MUTATION,
            variable_values={"id": str(secret_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteSecret"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_secret_service.get_actions.assert_awaited_once_with(secret_id=secret_id, requester=mocked_user)
        mock_secret_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_delete_secret_returns_true(
        self,
        mock_get_service,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_secret_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_secret_service.delete = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            DELETE_SECRET_MUTATION,
            variable_values={"id": str(secret_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteSecret": True}
        mock_secret_service.get_actions.assert_awaited_once_with(secret_id=secret_id, requester=mocked_user)
        mock_secret_service.delete.assert_awaited_once_with(secret_id=str(secret_id), requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_validate_secret_returns_validation_result(
        self,
        mock_get_service,
        mock_has_access,
        mock_secret_service,
        mocked_secret_response,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_has_access.return_value = True
        mock_secret_service.get_by_id = AsyncMock(return_value=mocked_secret_response)
        mock_secret_service.validate = AsyncMock(
            return_value=SecretValidationResponse(is_valid=True, message="Connection successful")
        )
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            VALIDATE_SECRET_MUTATION,
            variable_values={"id": str(secret_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"validateSecret": {"isValid": True, "message": "Connection successful"}}
        mock_has_access.assert_awaited_once_with(mocked_user, "secret", action="write")
        mock_secret_service.get_by_id.assert_awaited_once_with(secret_id=str(secret_id))
        mock_secret_service.validate.assert_awaited_once_with(mocked_secret_response)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_validate_secret_denies_without_write_access(
        self,
        mock_get_service,
        mock_has_access,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_has_access.return_value = False
        mock_secret_service.get_by_id = AsyncMock()
        mock_secret_service.validate = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            VALIDATE_SECRET_MUTATION,
            variable_values={"id": str(secret_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["validateSecret"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_secret_service.get_by_id.assert_not_awaited()
        mock_secret_service.validate.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_validate_secret_raises_when_not_found(
        self,
        mock_get_service,
        mock_has_access,
        mock_secret_service,
        mocked_user,
    ):
        secret_id = uuid4()
        mock_has_access.return_value = True
        mock_secret_service.get_by_id = AsyncMock(return_value=None)
        mock_secret_service.validate = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            VALIDATE_SECRET_MUTATION,
            variable_values={"id": str(secret_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["validateSecret"] is None
        assert result.errors is not None
        assert any("Secret not found" in error.message for error in result.errors)
        mock_secret_service.validate.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_validate_secret_config_returns_validation_result(
        self,
        mock_get_service,
        mock_has_access,
        mock_secret_service,
        mocked_secret,
        mocked_user,
    ):
        mock_has_access.return_value = True
        mock_secret_service.validate = AsyncMock(
            return_value=SecretValidationResponse(is_valid=True, message="Connection successful")
        )
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            VALIDATE_SECRET_CONFIG_MUTATION,
            variable_values={
                "input": {
                    "name": "TestSecret",
                    "secretType": "tofu",
                    "secretProvider": "aws",
                    "integrationId": str(mocked_secret.integration_id),
                    "configuration": {
                        "name": "test-secret",
                        "aws_region": "us-west-2",
                        "secret_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"validateSecretConfig": {"isValid": True, "message": "Connection successful"}}
        mock_has_access.assert_awaited_once_with(mocked_user, "secret", action="write")
        mock_secret_service.validate.assert_awaited_once_with(ANY)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.secret.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.secret.mutations.get_secret_service")
    async def test_validate_secret_config_denies_without_write_access(
        self,
        mock_get_service,
        mock_has_access,
        mock_secret_service,
        mocked_secret,
        mocked_user,
    ):
        mock_has_access.return_value = False
        mock_secret_service.validate = AsyncMock()
        mock_get_service.return_value = mock_secret_service

        result = await schema.execute(
            VALIDATE_SECRET_CONFIG_MUTATION,
            variable_values={
                "input": {
                    "name": "TestSecret",
                    "secretType": "tofu",
                    "secretProvider": "aws",
                    "integrationId": str(mocked_secret.integration_id),
                    "configuration": {
                        "name": "test-secret",
                        "aws_region": "us-west-2",
                        "secret_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["validateSecretConfig"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_secret_service.validate.assert_not_awaited()
