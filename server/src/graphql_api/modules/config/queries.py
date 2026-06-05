import strawberry
from strawberry.types import Info

from core.adapters.provider_adapters import IntegrationProvider, SecretProviderAdapter, StorageProviderAdapter
from core.auth_providers.dependencies import get_auth_provider_service
from core.config import InfrakitchenConfig
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
