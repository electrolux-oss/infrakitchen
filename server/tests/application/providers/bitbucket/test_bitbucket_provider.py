from typing import Any
from unittest.mock import AsyncMock, patch

import aiofiles
import pytest

from application.integrations.schema import (
    BitbucketIntegrationConfig,
    BitbucketSshIntegrationConfig,
)
from application.providers import (
    BitbucketProvider,
    BitbucketSshProvider,
)
from core.adapters.provider_adapters import IntegrationProvider
from core.errors import CloudWrongCredentials


@pytest.mark.asyncio
async def test_bitbucket_provider(mock_entity_logger):
    bitbucket_provider: type[BitbucketProvider] = IntegrationProvider.adapters["bitbucket"]
    kwargs: dict[str, Any] = dict()
    assert bitbucket_provider.__integration_provider_name__ == "bitbucket"
    # test ssh authentication
    configuration_ssh: BitbucketSshIntegrationConfig = BitbucketSshIntegrationConfig.model_validate(
        {
            "bitbucket_ssh_private_key": "test_ssh_key",
        }
    )
    kwargs["configuration"] = configuration_ssh
    kwargs["logger"] = mock_entity_logger

    provider_instance: BitbucketProvider = bitbucket_provider(**kwargs)
    provider_instance.workspace_root = None
    assert (
        provider_instance.bitbucket_ssh_private_key.get_decrypted_value()
        if provider_instance.bitbucket_ssh_private_key
        else None == "test_ssh_key"
    )

    await provider_instance.authenticate()
    assert provider_instance.environment_variables["GIT_SSH"] is not None
    assert provider_instance.environment_variables["GIT_SSH_COMMAND"] is not None

    # test the generated ssh key file
    # to make the git commands work, this private key file should always have at least one linebreak in the end
    async with aiofiles.open(provider_instance.environment_variables["GIT_SSH"]) as af:
        assert await af.read() == "test_ssh_key\n"


async def test_bitbucket_provider_http_auth(mock_entity_logger):
    bitbucket_provider: type[BitbucketProvider] = IntegrationProvider.adapters["bitbucket"]
    kwargs: dict[str, Any] = dict()
    assert bitbucket_provider.__integration_provider_name__ == "bitbucket"

    configuration = BitbucketIntegrationConfig.model_validate(
        {
            "bitbucket_user": "test_user@example.com",
            "bitbucket_key": "test_key",
        }
    )
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider_instance: BitbucketProvider = bitbucket_provider(**kwargs)
    provider_instance.workspace_root = None

    await provider_instance.authenticate()
    assert provider_instance.environment_variables["BITBUCKET_USER"] == "test_user@example.com"
    assert provider_instance.environment_variables["BITBUCKET_KEY"] == "test_key"


@pytest.mark.asyncio
async def test_bitbucket_provider_is_valid_success(mock_entity_logger, monkeypatch):
    configuration = {
        "bitbucket_user": "test_user@example.com",
        "bitbucket_key": "test_key",
    }
    mock_bitbucket_api_client = AsyncMock()
    mock_bitbucket_api_client.get_user_orgs.return_value = ["org1"]

    async def mock_get_api_client():
        return mock_bitbucket_api_client

    provider = BitbucketProvider(configuration=configuration)
    monkeypatch.setattr(provider, "get_api_client", mock_get_api_client)

    assert await provider.is_valid() is True


@pytest.mark.asyncio
async def test_bitbucket_provider_is_valid_get_user_orgs_exception(mock_entity_logger, monkeypatch):
    configuration = {
        "bitbucket_user": "test_user@example.com",
        "bitbucket_key": "test_key",
    }
    mock_bitbucket_api_client = AsyncMock()
    mock_bitbucket_api_client.get_user_orgs.side_effect = Exception("API error")

    async def mock_get_api_client():
        return mock_bitbucket_api_client

    provider = BitbucketProvider(configuration=configuration)
    monkeypatch.setattr(provider, "get_api_client", mock_get_api_client)

    with pytest.raises(CloudWrongCredentials) as exc_info:
        await provider.is_valid()

    assert str(exc_info.value) == "Bitbucket validation error"


@pytest.mark.asyncio
async def test_bitbucket_ssh_provider_is_valid_success(mock_entity_logger):
    """Test BitbucketSshProvider.is_valid with valid SSH key and successful connection."""
    bitbucket_ssh_provider: type[BitbucketSshProvider] = IntegrationProvider.adapters["bitbucket_ssh"]
    valid_ssh_key = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VjrF1EqLqgpQ
Test SSH key content for validation
-----END PRIVATE KEY-----"""

    configuration = BitbucketSshIntegrationConfig.model_validate({"bitbucket_ssh_private_key": valid_ssh_key})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: BitbucketSshProvider = bitbucket_ssh_provider(**kwargs)

    # Mock successful SSH connection
    mock_process = AsyncMock()
    mock_process.communicate.return_value = (b"", b"logged in as username. You can use git")
    mock_process.returncode = 0  # Bitbucket returns 0 on successful auth

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await provider.is_valid()
        assert result is True


@pytest.mark.asyncio
async def test_bitbucket_ssh_provider_is_valid_auth_failed(mock_entity_logger):
    """Test BitbucketSshProvider.is_valid with authentication failure."""
    bitbucket_ssh_provider: type[BitbucketSshProvider] = IntegrationProvider.adapters["bitbucket_ssh"]
    valid_ssh_key = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VjrF1EqLqgpQ
Test SSH key content for validation
-----END PRIVATE KEY-----"""

    configuration = BitbucketSshIntegrationConfig.model_validate({"bitbucket_ssh_private_key": valid_ssh_key})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: BitbucketSshProvider = bitbucket_ssh_provider(**kwargs)

    # Mock failed SSH connection
    mock_process = AsyncMock()
    mock_process.communicate.return_value = (b"", b"Permission denied (publickey)")
    mock_process.returncode = 255

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        with pytest.raises(CloudWrongCredentials, match="SSH key authentication failed"):
            await provider.is_valid()


@pytest.mark.asyncio
async def test_bitbucket_ssh_provider_is_valid_connection_failed(mock_entity_logger):
    """Test BitbucketSshProvider.is_valid with network connection failure."""
    bitbucket_ssh_provider: type[BitbucketSshProvider] = IntegrationProvider.adapters["bitbucket_ssh"]
    valid_ssh_key = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VjrF1EqLqgpQ
Test SSH key content for validation
-----END PRIVATE KEY-----"""

    configuration = BitbucketSshIntegrationConfig.model_validate({"bitbucket_ssh_private_key": valid_ssh_key})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: BitbucketSshProvider = bitbucket_ssh_provider(**kwargs)

    # Mock network connection failure
    mock_process = AsyncMock()
    mock_process.communicate.return_value = (b"", b"ssh: connect to host bitbucket.org port 22: Connection refused")
    mock_process.returncode = 255

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        with pytest.raises(CloudWrongCredentials, match="Unable to connect to Bitbucket"):
            await provider.is_valid()


@pytest.mark.asyncio
async def test_bitbucket_ssh_provider_is_valid_empty_key(mock_entity_logger):
    """Test BitbucketSshProvider.is_valid with empty SSH key."""
    bitbucket_ssh_provider: type[BitbucketSshProvider] = IntegrationProvider.adapters["bitbucket_ssh"]

    configuration = BitbucketSshIntegrationConfig.model_validate({"bitbucket_ssh_private_key": "   "})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: BitbucketSshProvider = bitbucket_ssh_provider(**kwargs)

    with pytest.raises(CloudWrongCredentials, match="SSH private key cannot be empty"):
        await provider.is_valid()


@pytest.mark.asyncio
async def test_bitbucket_ssh_provider_is_valid_invalid_format(mock_entity_logger):
    """Test BitbucketSshProvider.is_valid with invalid SSH key format."""
    bitbucket_ssh_provider: type[BitbucketSshProvider] = IntegrationProvider.adapters["bitbucket_ssh"]

    configuration = BitbucketSshIntegrationConfig.model_validate(
        {"bitbucket_ssh_private_key": "invalid-ssh-key-content"}
    )
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: BitbucketSshProvider = bitbucket_ssh_provider(**kwargs)

    with pytest.raises(CloudWrongCredentials, match="Invalid SSH private key format"):
        await provider.is_valid()
