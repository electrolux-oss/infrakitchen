import json
import logging
from typing import override
from application.providers.aws.aws_secrets_manager import AwsSecretManager
from application.secrets.schema import AWSSecretConfig
from core.adapters.provider_adapters import SecretProviderAdapter

logger = logging.getLogger("custom_secret_provider")


class AwsSecretManagerProvider(SecretProviderAdapter):
    __secret_provider_adapter_name__: str = "aws"

    def __init__(self, **kwargs) -> None:
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for AwsSecretManagerProvider")

        pydantic_config = AWSSecretConfig.model_validate(config)
        region = pydantic_config.aws_region
        environment_variables = kwargs.get("environment_variables", {})
        self.secret_name = pydantic_config.name

        if not environment_variables:
            raise ValueError("Environment variables are required for AwsSecretManagerProvider")

        self.client = AwsSecretManager(
            environment_variables=environment_variables,
            region=region,
        )

    @override
    async def is_valid(self) -> str:
        try:
            secret = await self.client.get_secret(self.secret_name)
            try:
                decoded_secret = json.loads(secret)
                return f"Successfully connected to AWS Secret Manager and retrieved secret: {self.secret_name}, keys: {list(decoded_secret.keys())}"  # noqa: E501
            except json.JSONDecodeError as e:
                raise ValueError("The secret retrieved is not a valid JSON") from e
        except Exception as e:
            logger.error(f"Failed to validate AWS Secret Manager connection: {e}")
            raise e

    @override
    async def add_secrets_to_env(self, **kwargs) -> None:
        secret = await self.client.get_secret(self.secret_name)
        try:
            secrets_dict = json.loads(secret)
            if not isinstance(secrets_dict, dict):
                raise ValueError("The secret retrieved is not a valid JSON object")
            for key, value in secrets_dict.items():
                self.environment_variables[f"TF_VAR_{key}"] = value
        except json.JSONDecodeError as e:
            raise ValueError("The secret retrieved is not a valid JSON") from e
