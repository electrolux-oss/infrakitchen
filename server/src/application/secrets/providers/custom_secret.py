import logging
from typing import override
from application.secrets.schema import CustomSecretConfig
from core.adapters.provider_adapters import SecretProviderAdapter

logger = logging.getLogger("custom_secret_provider")


class CustomSecretProvider(SecretProviderAdapter):
    __secret_provider_adapter_name__: str = "custom"
    logger: logging.Logger = logger

    def __init__(self, **kwargs) -> None:
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for CustomSecretAuthentication")
        self.configuration: CustomSecretConfig = CustomSecretConfig.model_validate(config)
        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})

    @override
    async def add_secrets_to_env(self, **kwargs) -> None:
        for secret in self.configuration.secrets:
            name = f"TF_VAR_{secret.name}"
            value = secret.value.get_decrypted_value()
            self.environment_variables[name] = value
