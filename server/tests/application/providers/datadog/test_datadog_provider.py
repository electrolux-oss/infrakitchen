from unittest.mock import AsyncMock, patch

import pytest

from application.providers.datadog.datadog_provider import DatadogProvider
from core.errors import CloudWrongCredentials


@pytest.mark.asyncio
async def test_datadog_provider_is_valid_success():
    configuration = {
        "datadog_api_url": "https://api.datadoghq.com",
        "datadog_api_key": "test_api_key",
        "datadog_app_key": "test_app_key",
    }
    mock_datadog_client = AsyncMock()
    mock_datadog_client.get.return_value = {"valid": True}

    with patch("application.providers.datadog.datadog_provider.DatadogClient", return_value=mock_datadog_client):
        provider = DatadogProvider(configuration=configuration)

        await provider.authenticate()
        assert await provider.is_valid() is True


@pytest.mark.asyncio
async def test_datadog_provider_is_valid_failure():
    configuration = {
        "datadog_api_url": "https://api.datadoghq.com",
        "datadog_api_key": "test_api_key",
        "datadog_app_key": "test_app_key",
    }
    mock_datadog_client = AsyncMock()
    mock_datadog_client.get.side_effect = CloudWrongCredentials("API error")

    with patch("application.providers.datadog.datadog_provider.DatadogClient", return_value=mock_datadog_client):
        provider = DatadogProvider(configuration=configuration)

        await provider.authenticate()
        with pytest.raises(CloudWrongCredentials) as exc_info:
            await provider.is_valid()
        assert str(exc_info.value) == "Datadog credentials are invalid."
