from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch

import pytest

from graphql_api.schema import schema

CREATE_INTEGRATION_WITH_STORAGE_MUTATION = """
    mutation CreateIntegrationWithStorage($input: IntegrationCreateWithStorageInput!) {
        createIntegrationWithStorage(input: $input) {
            id
            name
            entityName
            integrationProvider
        }
    }
"""

CREATE_TEMPLATE_WITH_SCV_MUTATION = """
    mutation CreateTemplateWithScv($input: TemplateCreateWithScvInput!) {
        createTemplateWithScv(input: $input) {
            id
            name
            entityName
        }
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestUseCaseMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.use_case.mutations.get_integration_with_storage_service")
    async def test_create_integration_with_storage_returns_created_integration(
        self,
        mock_get_service,
        mocked_integration,
        mocked_user,
    ):
        service = Mock()
        service.create = AsyncMock(return_value=mocked_integration)
        mock_get_service.return_value = service

        result = await schema.execute(
            CREATE_INTEGRATION_WITH_STORAGE_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Integration",
                    "description": "Test description",
                    "labels": ["label1"],
                    "integrationType": "cloud",
                    "integrationProvider": "aws",
                    "createStorage": True,
                    "configuration": {
                        "aws_account": "123456789012",
                        "aws_access_key_id": "test_access_key",
                        "aws_secret_access_key": "test_secret_key",
                        "integration_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createIntegrationWithStorage"] == {
            "id": str(mocked_integration.id),
            "name": mocked_integration.name,
            "entityName": "integration",
            "integrationProvider": mocked_integration.integration_provider,
        }
        service.create.assert_awaited_once_with(integration_with_storage=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.use_case.mutations.get_integration_with_storage_service")
    async def test_create_integration_with_storage_requires_authentication(
        self,
        mock_get_service,
        mocked_user,
    ):
        service = Mock()
        service.create = AsyncMock()
        mock_get_service.return_value = service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_INTEGRATION_WITH_STORAGE_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Integration",
                    "integrationType": "cloud",
                    "integrationProvider": "aws",
                    "configuration": {
                        "aws_account": "123456789012",
                        "aws_access_key_id": "test_access_key",
                        "aws_secret_access_key": "test_secret_key",
                        "integration_provider": "aws",
                    },
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createIntegrationWithStorage"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        service.create.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.use_case.mutations.get_template_with_scv_service")
    async def test_create_template_with_scv_returns_created_template(
        self,
        mock_get_service,
        mocked_template,
        mocked_user,
    ):
        service = Mock()
        service.create = AsyncMock(return_value=mocked_template)
        mock_get_service.return_value = service

        result = await schema.execute(
            CREATE_TEMPLATE_WITH_SCV_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Template",
                    "description": "Test description",
                    "labels": ["label1"],
                    "parents": [],
                    "sourceCodeLanguage": "opentofu",
                    "integrationId": "",
                    "sourceCodeUrl": "https://github.com/example/repo.git",
                    "sourceCodeFolder": "/",
                    "sourceCodeBranch": "main",
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createTemplateWithScv"] == {
            "id": str(mocked_template.id),
            "name": mocked_template.name,
            "entityName": "template",
        }
        service.create.assert_awaited_once_with(template_with_scv=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.use_case.mutations.get_template_with_scv_service")
    async def test_create_template_with_scv_requires_authentication(
        self,
        mock_get_service,
        mocked_user,
    ):
        service = Mock()
        service.create = AsyncMock()
        mock_get_service.return_value = service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_TEMPLATE_WITH_SCV_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Template",
                    "sourceCodeUrl": "https://github.com/example/repo.git",
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createTemplateWithScv"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        service.create.assert_not_awaited()
