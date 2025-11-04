import os
import stat
import tempfile
from typing import Any
from unittest.mock import AsyncMock, patch

import pytest

from application.integrations.schema import (
    GithubIntegrationConfig,
    GithubSshIntegrationConfig,
)

from application.providers import (
    GithubProvider,
    GithubSshProvider,
)

from application.providers.github.github_api import GithubApi
from core.adapters.provider_adapters import IntegrationProvider
from core.errors import CloudWrongCredentials
from core.tools.git_client import GitClient


async def _noop_async():
    return None


@pytest.mark.asyncio
async def test_github_provider_with_token(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    assert github_provider.__integration_provider_name__ == "github"
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "test_key"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = None
    # Avoid real HTTP verification
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    assert provider.environment_variables.get("GITHUB_TOKEN") == "test_key"


@pytest.mark.asyncio
async def test_github_provider_with_ssh(mock_entity_logger):
    github_provider: type[GithubSshProvider] = GithubSshProvider.adapters["github"]
    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": "test_ssh_key"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubSshProvider = github_provider(**kwargs)
    provider.workspace_root = None

    await provider.authenticate()
    assert provider.environment_variables["GIT_SSH"] is not None
    assert provider.environment_variables["GIT_SSH_COMMAND"] is not None


@pytest.mark.asyncio
async def test_github_provider_with_token_secret_only(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "secret_only_token"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    assert provider.environment_variables["GITHUB_TOKEN"] == "secret_only_token"


@pytest.mark.asyncio
async def test_github_provider_with_user_and_secret(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate(
        {"github_client_id": "userA", "github_client_secret": "tokenA"}
    )
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)

    called = {"v": False}

    async def fake_verify():
        called["v"] = True

    monkeypatch.setattr(provider, "verify_auth", fake_verify, raising=True)
    await provider.authenticate()
    # In user+secret path we expect basic auth style URL, not env var token
    assert "GITHUB_TOKEN" not in provider.environment_variables
    assert called["v"] is True


@pytest.mark.asyncio
async def test_github_provider_with_ssh_creates_keyfile(mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": "FAKE_SSH_KEY_DATA"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    await provider.authenticate()
    ssh_path = provider.environment_variables.get("GIT_SSH")
    assert ssh_path
    assert provider.environment_variables.get("GIT_SSH_COMMAND")
    assert os.path.isfile(ssh_path)
    with open(ssh_path, encoding="utf-8") as f:
        contents = f.read()
    assert contents.strip() == "FAKE_SSH_KEY_DATA"
    assert contents.endswith("\n")
    mode = stat.S_IMODE(os.stat(ssh_path).st_mode)
    assert mode == 0o600


@pytest.mark.asyncio
async def test_get_api_client_requires_auth(monkeypatch, mock_entity_logger):
    """
    Updated: new provider implementation now raises when not authenticated.
    """
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "abc123"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    api_client = await provider.get_api_client()
    assert isinstance(api_client, GithubApi)


@pytest.mark.asyncio
async def test_get_git_client_https_token(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "tok123"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="https://github.com/org/proj.git",
        workspace_root=provider.workspace_root,
        repo_name="proj",
    )
    assert isinstance(git_client, GitClient)
    assert "tok123@" in git_client.git_url


@pytest.mark.asyncio
async def test_get_git_client_https_user_token(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate(
        {"github_client_id": "devuser", "github_client_secret": "devtoken"}
    )
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="https://github.com/org/proj.git",
        workspace_root=provider.workspace_root,
        repo_name="proj",
    )
    assert "devuser:devtoken@" in git_client.git_url


@pytest.mark.asyncio
async def test_github_get_api_client(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "test_key"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = None

    with pytest.raises(ValueError, match="No valid authentication method provided for GithubClient."):
        await provider.get_api_client()

    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)

    await provider.authenticate()
    api_client = await provider.get_api_client()
    assert isinstance(api_client, GithubApi)


@pytest.mark.asyncio
async def test_get_git_client_ssh_url_unchanged(mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": "KEYDATA"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    await provider.authenticate()
    ssh_url = "git@github.com:org/proj.git"
    git_client = await provider.get_git_client(
        git_url=ssh_url,
        workspace_root=provider.workspace_root,
        repo_name="proj",
    )
    assert git_client.git_url == ssh_url


@pytest.mark.asyncio
async def test_is_valid_calls_verify_auth(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "tok"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    called = {"v": False}

    async def fake_verify():
        called["v"] = True

    monkeypatch.setattr(provider, "verify_auth", fake_verify, raising=True)
    ok = await provider.is_valid()
    assert ok is True
    assert called["v"] is True


@pytest.mark.asyncio
async def test_verify_auth_401_raises(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "bad"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)

    class Resp:
        status_code = 401

        def json(self):
            return {}

    class DummyClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **kw):
            return Resp()

    import application.providers.github.github_provider as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", lambda timeout=10: DummyClient())
    with pytest.raises(CloudWrongCredentials):
        await provider.verify_auth()


@pytest.mark.asyncio
async def test_verify_auth_non_200_raises(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "weird"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)

    class Resp:
        status_code = 500

        def json(self):
            return {}

    class DummyClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **kw):
            return Resp()

    import application.providers.github.github_provider as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", lambda timeout=10: DummyClient())
    with pytest.raises(CloudWrongCredentials):
        await provider.verify_auth()


@pytest.mark.asyncio
async def test_verify_auth_success(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "good"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)

    class Resp:
        status_code = 200

        def json(self):
            return {"login": "tester"}

    class DummyClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **kw):
            return Resp()

    import application.providers.github.github_provider as mod

    monkeypatch.setattr(mod.httpx, "AsyncClient", lambda timeout=10: DummyClient())
    await provider.verify_auth()


@pytest.mark.asyncio
async def test_get_api_client_after_auth(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "tok_after"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    api_client = await provider.get_api_client()
    assert isinstance(api_client, GithubApi)


@pytest.mark.asyncio
async def test_github_get_git_client_with_token(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate({"github_client_secret": "test_key"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="https://example.com/org/ik-workspace.git",
        workspace_root=provider.workspace_root,
        repo_name="ik-workspace",
    )
    assert isinstance(git_client, GitClient)
    assert "test_key" in git_client.git_url


@pytest.mark.asyncio
async def test_github_get_git_client_with_ssh(mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": "test_ssh_key"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="git@example.com:org/ik-workspace.git",
        workspace_root=provider.workspace_root,
        repo_name="ik-workspace",
    )
    assert isinstance(git_client, GitClient)
    assert git_client.git_url == "git@example.com:org/ik-workspace.git"


@pytest.mark.asyncio
async def test_github_get_git_client_with_user_pass(monkeypatch, mock_entity_logger):
    github_provider: type[GithubProvider] = IntegrationProvider.adapters["github"]
    configuration = GithubIntegrationConfig.model_validate(
        {"github_client_id": "test_user", "github_client_secret": "test_pass"}
    )
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GithubProvider = github_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="https://example.com/org/ik-workspace.git",
        workspace_root=provider.workspace_root,
        repo_name="ik-workspace",
    )
    assert isinstance(git_client, GitClient)
    assert "test_user:test_pass" in git_client.git_url


@pytest.mark.asyncio
async def test_github_ssh_provider_is_valid_success(mock_entity_logger):
    """Test GithubSshProvider.is_valid with valid SSH key and successful connection."""
    github_ssh_provider: type[GithubSshProvider] = IntegrationProvider.adapters["github_ssh"]
    valid_ssh_key = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VjrF1EqLqgpQ
Test SSH key content for validation
-----END PRIVATE KEY-----"""

    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": valid_ssh_key})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: GithubSshProvider = github_ssh_provider(**kwargs)

    # Mock successful SSH connection
    mock_process = AsyncMock()
    mock_process.communicate.return_value = (b"", b"Hi username! You've successfully authenticated")
    mock_process.returncode = 1  # GitHub returns 1 on successful auth

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        result = await provider.is_valid()
        assert result is True


@pytest.mark.asyncio
async def test_github_ssh_provider_is_valid_auth_failed(mock_entity_logger):
    """Test GithubSshProvider.is_valid with authentication failure."""
    github_ssh_provider: type[GithubSshProvider] = IntegrationProvider.adapters["github_ssh"]
    valid_ssh_key = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VjrF1EqLqgpQ
Test SSH key content for validation
-----END PRIVATE KEY-----"""

    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": valid_ssh_key})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: GithubSshProvider = github_ssh_provider(**kwargs)

    # Mock failed SSH connection
    mock_process = AsyncMock()
    mock_process.communicate.return_value = (b"", b"Permission denied (publickey)")
    mock_process.returncode = 255

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        with pytest.raises(CloudWrongCredentials, match="SSH key authentication failed"):
            await provider.is_valid()


@pytest.mark.asyncio
async def test_github_ssh_provider_is_valid_connection_failed(mock_entity_logger):
    """Test GithubSshProvider.is_valid with network connection failure."""
    github_ssh_provider: type[GithubSshProvider] = IntegrationProvider.adapters["github_ssh"]
    valid_ssh_key = """-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VjrF1EqLqgpQ
Test SSH key content for validation
-----END PRIVATE KEY-----"""

    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": valid_ssh_key})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: GithubSshProvider = github_ssh_provider(**kwargs)

    # Mock network connection failure
    mock_process = AsyncMock()
    mock_process.communicate.return_value = (b"", b"ssh: connect to host github.com port 22: Connection refused")
    mock_process.returncode = 255

    with patch("asyncio.create_subprocess_exec", return_value=mock_process):
        with pytest.raises(CloudWrongCredentials, match="Unable to connect to GitHub"):
            await provider.is_valid()


@pytest.mark.asyncio
async def test_github_ssh_provider_is_valid_empty_key(mock_entity_logger):
    """Test GithubSshProvider.is_valid with empty SSH key."""
    github_ssh_provider: type[GithubSshProvider] = IntegrationProvider.adapters["github_ssh"]

    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": "   "})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: GithubSshProvider = github_ssh_provider(**kwargs)

    with pytest.raises(CloudWrongCredentials, match="SSH private key cannot be empty"):
        await provider.is_valid()


@pytest.mark.asyncio
async def test_github_ssh_provider_is_valid_invalid_format(mock_entity_logger):
    """Test GithubSshProvider.is_valid with invalid SSH key format."""
    github_ssh_provider: type[GithubSshProvider] = IntegrationProvider.adapters["github_ssh"]

    configuration = GithubSshIntegrationConfig.model_validate({"github_ssh_private_key": "invalid-ssh-key-content"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger

    provider: GithubSshProvider = github_ssh_provider(**kwargs)

    with pytest.raises(CloudWrongCredentials, match="Invalid SSH private key format"):
        await provider.is_valid()
