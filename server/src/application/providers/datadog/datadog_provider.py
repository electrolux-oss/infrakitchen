import logging
from typing import override

from application.integrations.schema import DatadogIntegrationConfig
from .datadog_client import DatadogClient
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials
from core.models.encrypted_secret import EncryptedSecretStr

log = logging.getLogger("datadog_provider")


class DatadogAuthentication:
    environment_variables: dict[str, str]
    workspace_root: str | None = None
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log

        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for DatadogAuthentication")
        configuration = DatadogIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.datadog_api_url: str = configuration.datadog_api_url
        self.datadog_api_key: EncryptedSecretStr | None = configuration.datadog_api_key
        self.datadog_app_key: EncryptedSecretStr | None = configuration.datadog_app_key

    async def authenticate_datadog(self) -> None:
        if self.datadog_api_url and (self.datadog_api_key or self.datadog_app_key):
            self.logger.info("Authenticating with Datadog...")
            self.environment_variables["DD_HOST"] = self.datadog_api_url
            if self.datadog_api_key:
                self.environment_variables["DD_API_KEY"] = self.datadog_api_key.get_decrypted_value()
            if self.datadog_app_key:
                self.environment_variables["DD_APP_KEY"] = self.datadog_app_key.get_decrypted_value()
        else:
            self.logger.error("No valid authentication method provided for Datadog.")
            raise CloudWrongCredentials("No valid authentication method provided for Datadog.")


class DatadogProvider(IntegrationProvider, DatadogAuthentication):
    __integration_provider_name__: str = "datadog"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_datadog()

    @override
    async def is_valid(self) -> bool:
        datadog_client = DatadogClient(environment_variables=self.environment_variables)
        try:
            return await datadog_client.get("/api/v1/validate") is not None
        except Exception as e:
            raise CloudWrongCredentials("Datadog credentials are invalid.", metadata=[{"cloud_message": str(e)}]) from e
