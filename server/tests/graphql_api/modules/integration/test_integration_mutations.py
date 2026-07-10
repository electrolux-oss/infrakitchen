from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.integrations.schema import IntegrationValidationResponse
from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_INTEGRATION_MUTATION = """
    mutation CreateIntegration($input: IntegrationCreateInput!) {
        createIntegration(input: $input) {
            id
            name
            integrationProvider
            entityName
        }
    }
"""

UPDATE_INTEGRATION_MUTATION = """
    mutation UpdateIntegration($id: UUID!, $input: IntegrationUpdateInput!) {
        updateIntegration(id: $id, input: $input) {
            id
            name
            integrationProvider
            entityName
        }
    }
"""

INTEGRATION_ACTION_MUTATION = """
    mutation IntegrationAction($id: UUID!, $input: IntegrationActionInput!) {
        integrationAction(id: $id, input: $input) {
            id
            name
            integrationProvider
            entityName
        }
    }
"""

DELETE_INTEGRATION_MUTATION = """
    mutation DeleteIntegration($id: UUID!) {
        deleteIntegration(id: $id)
    }
"""


VALIDATE_INTEGRATION_MUTATION = """
    mutation ValidateIntegration($id: UUID!) {
        validateIntegration(id: $id) {
            isValid
            message
        }
    }
"""

VALIDATE_INTEGRATION_CONFIG_MUTATION = """
    mutation ValidateIntegrationConfig($input: IntegrationCreateInput!) {
        validateIntegrationConfig(input: $input) {
            isValid
            message
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestIntegrationMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_create_integration_returns_created_integration(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        mock_integration_service.create_integration = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            CREATE_INTEGRATION_MUTATION,
            variable_values={
                "input": {
                    "name": "Test Integration",
                    "integrationType": "cloud",
                    "integrationProvider": "aws",
                    "configuration": {
                        "aws_account": "123456789012",
                        "aws_access_key_id": "test_key",
                        "aws_secret_access_key": "test_secret",
                        "integration_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createIntegration"] == {
            "id": str(mocked_integration.id),
            "name": mocked_integration.name,
            "integrationProvider": mocked_integration.integration_provider,
            "entityName": "integration",
        }
        mock_integration_service.create_integration.assert_awaited_once_with(integration=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_create_integration_requires_authentication(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_user,
    ):
        mock_integration_service.create_integration = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_INTEGRATION_MUTATION,
            variable_values={
                "input": {
                    "name": "Test Integration",
                    "integrationType": "cloud",
                    "integrationProvider": "aws",
                    "configuration": {
                        "aws_account": "123456789012",
                        "aws_access_key_id": "test_key",
                        "aws_secret_access_key": "test_secret",
                        "integration_provider": "aws",
                    },
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createIntegration"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_integration_service.create_integration.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_update_integration_denies_without_edit_action(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[])
        mock_integration_service.update_integration = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            UPDATE_INTEGRATION_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {
                    "name": "Updated Integration",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateIntegration"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_integration_service.get_actions.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )
        mock_integration_service.update_integration.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_update_integration_returns_updated_integration(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_integration_service.update_integration = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            UPDATE_INTEGRATION_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {
                    "name": "Updated Integration",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateIntegration"] == {
            "id": str(mocked_integration.id),
            "name": mocked_integration.name,
            "integrationProvider": mocked_integration.integration_provider,
            "entityName": "integration",
        }
        mock_integration_service.get_actions.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )
        mock_integration_service.update_integration.assert_awaited_once_with(
            integration_id=str(integration_id),
            integration=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_integration_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock()
        mock_integration_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            INTEGRATION_ACTION_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["integrationAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_integration_service.get_actions.assert_not_awaited()
        mock_integration_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_integration_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[])
        mock_integration_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            INTEGRATION_ACTION_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["integrationAction"] is None
        assert result.errors is not None
        assert any("Access denied for action disable" in error.message for error in result.errors)
        mock_integration_service.get_actions.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )
        mock_integration_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_integration_action_returns_updated_integration(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.DISABLE.value])
        mock_integration_service.patch_action = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            INTEGRATION_ACTION_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {
                    "action": ModelActions.DISABLE.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["integrationAction"] == {
            "id": str(mocked_integration.id),
            "name": mocked_integration.name,
            "integrationProvider": mocked_integration.integration_provider,
            "entityName": "integration",
        }
        mock_integration_service.get_actions.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )
        mock_integration_service.patch_action.assert_awaited_once()
        assert mock_integration_service.patch_action.await_args
        call_kwargs = mock_integration_service.patch_action.await_args.kwargs
        assert call_kwargs["integration_id"] == str(integration_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.DISABLE.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_delete_integration_denies_without_delete_action(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[])
        mock_integration_service.delete = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            DELETE_INTEGRATION_MUTATION,
            variable_values={"id": str(integration_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteIntegration"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_integration_service.get_actions.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )
        mock_integration_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_delete_integration_returns_true(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_integration_service.delete = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            DELETE_INTEGRATION_MUTATION,
            variable_values={"id": str(integration_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteIntegration": True}
        mock_integration_service.get_actions.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )
        mock_integration_service.delete.assert_awaited_once_with(
            integration_id=str(integration_id), requester=mocked_user
        )


UPDATE_INTEGRATION_FULL_MUTATION = """
    mutation UpdateIntegration($id: UUID!, $input: IntegrationUpdateInput!) {
        updateIntegration(id: $id, input: $input) {
            id
            name
            description
            labels
            integrationProvider
            configuration
        }
    }
"""


class TestIntegrationPartialUpdate:
    """Verify that partial GraphQL updates only touch explicitly provided fields."""

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_update_name_only_preserves_other_fields(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        """Sending only {name} must not overwrite description, labels, or configuration."""
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_integration_service.update_integration = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            UPDATE_INTEGRATION_FULL_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {"name": "Renamed"},
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        mock_integration_service.update_integration.assert_awaited_once()
        assert mock_integration_service.update_integration.await_args
        call_kwargs = mock_integration_service.update_integration.await_args.kwargs
        pydantic_model = call_kwargs["integration"]

        # Only name should carry a non-default value; other fields stay at None
        # so model_db_dump(exclude_defaults=True, exclude_none=True) will drop them.
        assert pydantic_model.name == "Renamed"
        assert pydantic_model.description is None
        assert pydantic_model.labels is None
        assert pydantic_model.configuration is None

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_update_description_only_preserves_other_fields(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        """Sending only {description} must not overwrite name, labels, or configuration."""
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_integration_service.update_integration = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            UPDATE_INTEGRATION_FULL_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {"description": "new desc"},
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert mock_integration_service.update_integration.await_args
        call_kwargs = mock_integration_service.update_integration.await_args.kwargs
        pydantic_model = call_kwargs["integration"]

        assert pydantic_model.description == "new desc"
        assert pydantic_model.name is None
        assert pydantic_model.labels is None
        assert pydantic_model.configuration is None

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_update_labels_only_preserves_other_fields(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        """Sending only {labels} must not overwrite name, description, or configuration."""
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_integration_service.update_integration = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            UPDATE_INTEGRATION_FULL_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {"labels": ["prod", "aws"]},
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert mock_integration_service.update_integration.await_args
        call_kwargs = mock_integration_service.update_integration.await_args.kwargs
        pydantic_model = call_kwargs["integration"]

        assert pydantic_model.labels == ["prod", "aws"]
        assert pydantic_model.name is None
        assert pydantic_model.description is None
        assert pydantic_model.configuration is None

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_update_empty_labels_clears_labels(
        self,
        mock_get_service,
        mock_integration_service,
        mocked_integration,
        mocked_user,
    ):
        """Sending {labels: []} must clear labels, not be silently dropped."""
        integration_id = uuid4()
        mock_integration_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_integration_service.update_integration = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            UPDATE_INTEGRATION_FULL_MUTATION,
            variable_values={
                "id": str(integration_id),
                "input": {"labels": []},
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert mock_integration_service.update_integration.await_args
        call_kwargs = mock_integration_service.update_integration.await_args.kwargs
        pydantic_model = call_kwargs["integration"]

        # Explicit empty list must survive as [] (not be dropped as None)
        assert pydantic_model.labels == []
        assert pydantic_model.name is None
        assert pydantic_model.description is None
        assert pydantic_model.configuration is None


class TestIntegrationValidationMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.user_has_access_to_entity", new_callable=AsyncMock)
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_validate_integration_returns_validation_result(
        self,
        mock_get_service,
        mock_has_access,
        mock_integration_service,
        mocked_integration_response,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_has_access.return_value = True
        mock_integration_service.get_by_id = AsyncMock(return_value=mocked_integration_response)
        mock_integration_service.validate = AsyncMock(
            return_value=IntegrationValidationResponse(is_valid=True, message="Validation successful")
        )
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            VALIDATE_INTEGRATION_MUTATION,
            variable_values={"id": str(integration_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"validateIntegration": {"isValid": True, "message": "Validation successful"}}
        mock_has_access.assert_awaited_once_with(
            mocked_user, str(integration_id), action="write", entity_name="integration"
        )
        mock_integration_service.get_by_id.assert_awaited_once_with(integration_id=str(integration_id))
        mock_integration_service.validate.assert_awaited_once_with(
            integration_config=mocked_integration_response.configuration,
            integration_provider=mocked_integration_response.integration_provider,
            integration_id=integration_id,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.user_has_access_to_entity", new_callable=AsyncMock)
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_validate_integration_denies_without_write_access(
        self,
        mock_get_service,
        mock_has_access,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_has_access.return_value = False
        mock_integration_service.get_by_id = AsyncMock()
        mock_integration_service.validate = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            VALIDATE_INTEGRATION_MUTATION,
            variable_values={"id": str(integration_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["validateIntegration"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_integration_service.get_by_id.assert_not_awaited()
        mock_integration_service.validate.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.user_has_access_to_entity", new_callable=AsyncMock)
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_validate_integration_raises_when_not_found(
        self,
        mock_get_service,
        mock_has_access,
        mock_integration_service,
        mocked_user,
    ):
        integration_id = uuid4()
        mock_has_access.return_value = True
        mock_integration_service.get_by_id = AsyncMock(return_value=None)
        mock_integration_service.validate = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            VALIDATE_INTEGRATION_MUTATION,
            variable_values={"id": str(integration_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["validateIntegration"] is None
        assert result.errors is not None
        assert any("Integration not found" in error.message for error in result.errors)
        mock_integration_service.validate.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_validate_integration_config_returns_validation_result(
        self,
        mock_get_service,
        mock_has_access,
        mock_integration_service,
        mocked_user,
    ):
        mock_has_access.return_value = True
        mock_integration_service.validate = AsyncMock(
            return_value=IntegrationValidationResponse(is_valid=True, message="Validation successful")
        )
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            VALIDATE_INTEGRATION_CONFIG_MUTATION,
            variable_values={
                "input": {
                    "name": "Test Integration",
                    "integrationType": "cloud",
                    "integrationProvider": "aws",
                    "configuration": {
                        "aws_account": "123456789012",
                        "aws_access_key_id": "test_key",
                        "aws_secret_access_key": "test_secret",
                        "integration_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"validateIntegrationConfig": {"isValid": True, "message": "Validation successful"}}
        mock_has_access.assert_awaited_once_with(mocked_user, "integration", action="write")
        mock_integration_service.validate.assert_awaited_once_with(integration_config=ANY, integration_provider="aws")

    @pytest.mark.asyncio
    @patch("graphql_api.modules.integration.mutations.user_has_access_to_api", new_callable=AsyncMock)
    @patch("graphql_api.modules.integration.mutations.get_integration_service")
    async def test_validate_integration_config_denies_without_write_access(
        self,
        mock_get_service,
        mock_has_access,
        mock_integration_service,
        mocked_user,
    ):
        mock_has_access.return_value = False
        mock_integration_service.validate = AsyncMock()
        mock_get_service.return_value = mock_integration_service

        result = await schema.execute(
            VALIDATE_INTEGRATION_CONFIG_MUTATION,
            variable_values={
                "input": {
                    "name": "Test Integration",
                    "integrationType": "cloud",
                    "integrationProvider": "aws",
                    "configuration": {
                        "aws_account": "123456789012",
                        "aws_access_key_id": "test_key",
                        "aws_secret_access_key": "test_secret",
                        "integration_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["validateIntegrationConfig"] is None
        assert result.errors is not None
        assert any("Access denied" in error.message for error in result.errors)
        mock_integration_service.validate.assert_not_awaited()
