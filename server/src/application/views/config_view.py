from fastapi import APIRouter, Depends

from core.adapters.provider_adapters import IntegrationProvider, SecretProviderAdapter, StorageProviderAdapter
from core.auth_providers.dependencies import get_auth_provider_service
from core.auth_providers.service import AuthProviderService
from core.config import InfrakitchenConfig

router = APIRouter()


@router.get(
    "/configs/auth_providers",
    response_description="Get Infrakitchen auth providers",
    response_model=list[str],
    response_model_by_alias=False,
)
async def get(service: AuthProviderService = Depends(get_auth_provider_service)):
    enabled_providers = await service.get_all(filter={"enabled": True})
    return [provider.auth_provider for provider in enabled_providers]


@router.get(
    "/configs/global",
    response_description="Get Infrakitchen global config",
    response_model=dict,
    response_model_by_alias=False,
)
async def get_global_ui_config():
    global_config = InfrakitchenConfig().to_dict()
    # integration provider registries
    cloud_provider_registry = list()
    git_provider_registry = list()
    for provider_name, provider_cls in IntegrationProvider.adapters.items():
        if provider_cls.__integration_provider_type__ == "cloud":
            cloud_provider_registry.append(provider_name)
        elif provider_cls.__integration_provider_type__ == "git":
            git_provider_registry.append(provider_name)
    global_config.update(
        {
            "cloud_provider_registry": cloud_provider_registry,
            "git_provider_registry": git_provider_registry,
        }
    )

    # storage provider registries
    storage_provider_registry = StorageProviderAdapter.adapters.keys()
    global_config.update({"storage_provider_registry": list(storage_provider_registry)})

    # secret provider registries
    secret_provider_registry = SecretProviderAdapter.adapters.keys()
    global_config.update({"secret_provider_registry": list(secret_provider_registry)})
    return global_config
