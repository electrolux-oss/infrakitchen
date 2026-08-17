import platform
from typing import cast
from urllib.parse import urlparse

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.adapters.provider_adapters import IntegrationProvider, SecretProviderAdapter, StorageProviderAdapter
from core.auth_providers.dependencies import get_auth_provider_service
from core.config import InfrakitchenConfig
from core.utils.entities import get_all_entities
from core.workers.functions import get_host_metadata
from graphql_api.helpers import IsAuthenticated


@strawberry.type
class GlobalConfigType:
    approval_flow: bool
    demo_mode: bool
    websocket: bool
    cloud_provider_registry: list[str]
    git_provider_registry: list[str]
    notification_provider_registry: list[str]
    storage_provider_registry: list[str]
    secret_provider_registry: list[str]


@strawberry.type
class ServerInfoType:
    version: str
    version_url: str
    repository: str
    repository_url: str
    source_commit: str
    source_commit_short: str
    source_url: str
    python: str
    host_metadata: JSON


def _prefixed_version(version: str) -> str:
    if version == "unknown" or version.startswith("v"):
        return version
    return f"v{version}"


def _repository_provider(repository_url: str) -> str:
    if not repository_url:
        return "unknown"

    hostname = urlparse(repository_url).hostname or ""
    if hostname == "github.com":
        return "github"
    if hostname == "gitlab.com" or hostname.endswith(".gitlab.com"):
        return "gitlab"
    if hostname == "bitbucket.org":
        return "bitbucket"
    return "unknown"


def _repository_url(repository_url: str) -> str:
    if not repository_url:
        return ""
    return repository_url.rstrip("/")


def _release_url(repository_url: str, version: str) -> str:
    if not repository_url or version == "unknown":
        return ""

    base_url = _repository_url(repository_url)
    provider = _repository_provider(repository_url)
    if provider == "github":
        return f"{base_url}/releases/tag/{version}"
    if provider == "gitlab":
        return f"{base_url}/-/releases/{version}"
    return ""


def _commit_url(repository_url: str, commit: str) -> str:
    if not repository_url or commit == "unknown":
        return ""

    base_url = _repository_url(repository_url)
    provider = _repository_provider(repository_url)
    if provider == "github":
        return f"{base_url}/commit/{commit}"
    if provider == "gitlab":
        return f"{base_url}/-/commit/{commit}"
    if provider == "bitbucket":
        return f"{base_url}/commits/{commit}"
    return ""


def _build_url(repository_url: str, build: str) -> str:
    if not repository_url or build == "unknown":
        return ""

    if _repository_provider(repository_url) == "github":
        return f"{_repository_url(repository_url)}/actions/runs/{build}"
    return ""


@strawberry.type
class ConfigQuery:
    @strawberry.field
    async def enabled_auth_providers(self, info: Info) -> list[str]:
        session = info.context["session"]
        service = get_auth_provider_service(session=session)
        enabled_providers = await service.query_all(
            filter={"enabled": True}, fields={"auth_provider": None, "enabled": None}
        )
        return [provider.auth_provider for provider in enabled_providers]

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def global_config(self, info: Info) -> GlobalConfigType:
        config = InfrakitchenConfig()

        cloud_provider_registry: list[str] = []
        git_provider_registry: list[str] = []
        notification_provider_registry: list[str] = []
        for provider_name, provider_cls in IntegrationProvider.adapters.items():
            if provider_cls.__integration_provider_type__ == "cloud":
                cloud_provider_registry.append(provider_name)
            elif provider_cls.__integration_provider_type__ == "git":
                git_provider_registry.append(provider_name)
            elif provider_cls.__integration_provider_type__ == "notification":
                notification_provider_registry.append(provider_name)

        return GlobalConfigType(
            approval_flow=config.approval_flow,
            demo_mode=config.demo_mode,
            websocket=config.websocket,
            cloud_provider_registry=cloud_provider_registry,
            git_provider_registry=git_provider_registry,
            notification_provider_registry=notification_provider_registry,
            storage_provider_registry=list(StorageProviderAdapter.adapters.keys()),
            secret_provider_registry=list(SecretProviderAdapter.adapters.keys()),
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def server_info(self, info: Info) -> ServerInfoType:
        config = InfrakitchenConfig()
        version = _prefixed_version(config.server_version)

        return ServerInfoType(
            version=version,
            version_url=_release_url(config.repository_url, version),
            repository=config.repository,
            repository_url=_repository_url(config.repository_url),
            source_commit=config.git_commit,
            source_commit_short=config.git_commit_short,
            source_url=_commit_url(config.repository_url, config.git_commit),
            python=platform.python_version(),
            host_metadata=cast(JSON, cast(object, await get_host_metadata())),
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def entities(self, info: Info) -> list[str]:
        return get_all_entities()
