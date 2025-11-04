from unittest.mock import patch, AsyncMock

import pytest

from application.providers.azurerm.azure_devops_repo_provider import AzureRepoSourceCode
from core.errors import CloudWrongCredentials


@pytest.mark.asyncio
async def test_azure_devops_repo_provider_is_valid_success():
    configuration = {
        "azure_access_token": "test_token",
        "organization": "test_organization",
    }
    mock_azure_api_client = AsyncMock()
    mock_azure_api_client.get_projects.return_value = ["project1", "project2"]

    with patch(
        "application.providers.azurerm.azure_devops_repo_provider.AzureDevopsApi", return_value=mock_azure_api_client
    ):
        provider = AzureRepoSourceCode(configuration=configuration)

        await provider.authenticate()
        assert await provider.is_valid() is True


@pytest.mark.asyncio
async def test_azure_devops_repo_provider_is_valid_failure():
    configuration = {
        "azure_access_token": "test_token",
        "organization": "test_organization",
    }
    mock_azure_api_client = AsyncMock()
    mock_azure_api_client.get_projects.side_effect = Exception("API error")

    with patch(
        "application.providers.azurerm.azure_devops_repo_provider.AzureDevopsApi", return_value=mock_azure_api_client
    ):
        provider = AzureRepoSourceCode(configuration=configuration)

        await provider.authenticate()
        with pytest.raises(CloudWrongCredentials, match="Azure Devops validation failed: API error"):
            await provider.is_valid()
