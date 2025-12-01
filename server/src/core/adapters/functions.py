from typing import Any

from core.adapters.provider_adapters import IntegrationProvider, SecretProviderAdapter
from core.errors import CannotProceed


async def get_integration_adapter(provider: str, config: Any) -> IntegrationProvider:
    provider_adapter_cls = IntegrationProvider.adapters.get(provider)
    if provider_adapter_cls:
        return provider_adapter_cls(configuration=config)

    raise CannotProceed(f"Provider {provider} is not supported")


async def get_secret_adapter(
    provider: str, config: Any, environment_variables: dict[str, str] | None = None
) -> SecretProviderAdapter:
    secret_provider_adapter_cls = SecretProviderAdapter.adapters.get(provider)
    if secret_provider_adapter_cls:
        return secret_provider_adapter_cls(configuration=config, environment_variables=environment_variables or {})

    raise CannotProceed(f"Provider {provider} is not supported")
