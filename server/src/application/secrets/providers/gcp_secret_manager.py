import json
import logging
from typing import override
from application.providers.gcp.gcp_secret_manager import GcpSecretManager
from application.secrets.schema import GCPSecretConfig
from core.adapters.provider_adapters import SecretProviderAdapter

logger = logging.getLogger("custom_secret_provider")


class GcpSecretManagerProvider(SecretProviderAdapter):
    __secret_provider_adapter_name__: str = "gcp"

    def __init__(self, **kwargs) -> None:
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for GcpSecretManagerProvider")

        pydantic_config = GCPSecretConfig.model_validate(config)
        self.region = pydantic_config.gcp_region
        environment_variables = kwargs.get("environment_variables", {})
        self.secret_name = pydantic_config.name

        if not environment_variables:
            raise ValueError("Environment variables are required for GcpSecretManagerProvider")

        self.client = GcpSecretManager(
            environment_variables=environment_variables,
            region=self.region,
        )

    @override
    async def is_valid(self) -> str:
        try:
            secret = await self.client.get_secret(self.secret_name, self.region)
            try:
                decoded_secret = json.loads(secret.payload.data.decode("UTF-8"))
                return f"Successfully connected to GCP Secret Manager and retrieved secret: {self.secret_name}, keys: {list(decoded_secret.keys())}"  # noqa: E501
            except json.JSONDecodeError as e:
                raise ValueError("The secret retrieved is not a valid JSON") from e
        except Exception as e:
            logger.error(f"Failed to validate AWS Secret Manager connection: {e}")
            raise e

    @override
    async def add_secrets_to_env(self, **kwargs) -> None:
        secret = await self.client.get_secret(self.secret_name, self.region)
        try:
            secrets_dict = json.loads(secret.payload.data.decode("UTF-8"))
            if not isinstance(secrets_dict, dict):
                raise ValueError("The secret retrieved is not a valid JSON object")
            for key, value in secrets_dict.items():
                self.environment_variables[f"TF_VAR_{key}"] = value
        except json.JSONDecodeError as e:
            raise ValueError("The secret retrieved is not a valid JSON") from e
