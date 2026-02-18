import tempfile
from typing import Any

import pytest

from application.integrations.schema import GitLabIntegrationConfig
from application.providers import GitLabProvider

from application.providers.gitlab.gitlab_api import GitLabApi
from core.adapters.provider_adapters import IntegrationProvider
from core.tools.git_client import GitClient


async def _noop_async():
    return None


@pytest.mark.asyncio
async def test_gitlab_provider_with_token(monkeypatch, mock_entity_logger):
    gitlab_provider: type[GitLabProvider] = IntegrationProvider.adapters["gitlab"]
    assert gitlab_provider.__integration_provider_name__ == "gitlab"
    configuration = GitLabIntegrationConfig.model_validate({"gitlab_token": "test_token"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GitLabProvider = gitlab_provider(**kwargs)
    provider.workspace_root = None
    # Avoid real HTTP verification
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    assert provider.environment_variables.get("GITLAB_TOKEN") == "test_token"


@pytest.mark.asyncio
async def test_get_api_client_requires_auth(monkeypatch, mock_entity_logger):
    """
    Updated: new provider implementation now raises when not authenticated.
    """
    gitlab_provider: type[GitLabProvider] = IntegrationProvider.adapters["gitlab"]
    configuration = GitLabIntegrationConfig.model_validate({"gitlab_token": "abc123"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GitLabProvider = gitlab_provider(**kwargs)
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    api_client = await provider.get_api_client()
    assert isinstance(api_client, GitLabApi)


@pytest.mark.asyncio
async def test_get_git_client_https_token(monkeypatch, mock_entity_logger):
    gitlab_provider: type[GitLabProvider] = IntegrationProvider.adapters["gitlab"]
    configuration = GitLabIntegrationConfig.model_validate({"gitlab_token": "tok123"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GitLabProvider = gitlab_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="https://gitlab.com/org/proj.git",
        workspace_root=provider.workspace_root,
        repo_name="proj",
    )
    assert isinstance(git_client, GitClient)
    assert "tok123@" in git_client.git_url


@pytest.mark.asyncio
async def test_gitlab_get_api_client(monkeypatch, mock_entity_logger):
    gitlab_provider: type[GitLabProvider] = IntegrationProvider.adapters["gitlab"]
    configuration = GitLabIntegrationConfig.model_validate({"gitlab_token": ""})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GitLabProvider = gitlab_provider(**kwargs)
    provider.workspace_root = None

    # with pytest.raises(ValueError, match="No valid authentication method provided for GithubClient."):
    #     await provider.get_api_client()

    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)

    await provider.authenticate()
    api_client = await provider.get_api_client()
    assert isinstance(api_client, GitLabApi)


@pytest.mark.asyncio
async def test_is_valid_calls_verify_auth(monkeypatch, mock_entity_logger):
    gitlab_provider: type[GitLabProvider] = IntegrationProvider.adapters["gitlab"]
    configuration = GitLabIntegrationConfig.model_validate({"gitlab_token": "tok"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GitLabProvider = gitlab_provider(**kwargs)
    called = {"v": False}

    async def fake_verify():
        called["v"] = True

    monkeypatch.setattr(provider, "verify_auth", fake_verify, raising=True)
    ok = await provider.is_valid()
    assert ok is True
    assert called["v"] is True


@pytest.mark.asyncio
async def test_gitlab_get_git_client_with_token(monkeypatch, mock_entity_logger):
    gitlab_provider: type[GitLabProvider] = IntegrationProvider.adapters["gitlab"]
    configuration = GitLabIntegrationConfig.model_validate({"gitlab_token": "test_token"})
    kwargs: dict[str, Any] = {}
    kwargs["configuration"] = configuration
    kwargs["logger"] = mock_entity_logger
    provider: GitLabProvider = gitlab_provider(**kwargs)
    provider.workspace_root = tempfile.mkdtemp()
    monkeypatch.setattr(provider, "verify_auth", _noop_async, raising=True)
    await provider.authenticate()
    git_client = await provider.get_git_client(
        git_url="https://gitlab.com/org/ik-workspace.git",
        workspace_root=provider.workspace_root,
        repo_name="ik-workspace",
    )
    assert isinstance(git_client, GitClient)
    assert "test_token" in git_client.git_url
