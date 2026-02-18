import logging
from typing import override

from application.providers.azurerm.azure_client import AzureClient
from core.adapters.provider_adapters import IntegrationProvider
from core.custom_entity_log_controller import EntityLogger
from core.errors import CloudWrongCredentials

from ...integrations.schema import AzureRMIntegrationConfig

log = logging.getLogger("azurerm_provider")


class AzurermAuthentication:
    logger: logging.Logger | EntityLogger = log
    environment_variables: dict[str, str]

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        self.logger: logging.Logger | EntityLogger = logger if logger else log
        config = kwargs.get("configuration")
        if not config:
            raise ValueError("Configuration is required for AzurermAuthentication")
        configuration = AzureRMIntegrationConfig.model_validate(config)

        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})
        self.client_id: str = configuration.client_id
        self.client_secret: str = configuration.client_secret.get_decrypted_value()
        self.tenant_id: str = configuration.tenant_id
        self.subscription_id: str = configuration.subscription_id

    async def authenticate_azurerm(self) -> None:
        if self.client_id and self.client_secret and self.tenant_id and self.subscription_id:
            self.logger.info("Authenticating with AzureRM...")
            self.environment_variables["ARM_CLIENT_ID"] = self.client_id
            self.environment_variables["ARM_CLIENT_SECRET"] = self.client_secret
            self.environment_variables["ARM_TENANT_ID"] = self.tenant_id
            self.environment_variables["ARM_SUBSCRIPTION_ID"] = self.subscription_id
            # Also set the AZURE_ prefixed variables for compatibility
            self.environment_variables["AZURE_CLIENT_ID"] = self.client_id
            self.environment_variables["AZURE_CLIENT_SECRET"] = self.client_secret
            self.environment_variables["AZURE_TENANT_ID"] = self.tenant_id
            self.environment_variables["AZURE_SUBSCRIPTION_ID"] = self.subscription_id
        else:
            self.logger.error("No valid authentication method provided for Azure Resource Manager.")
            raise CloudWrongCredentials("No valid authentication method provided for Azure Resource Manager.")


class AzurermProvider(IntegrationProvider, AzurermAuthentication):
    __integration_provider_name__: str = "azurerm"
    __integration_provider_type__: str = "cloud"
    logger: logging.Logger | EntityLogger = log

    def __init__(self, logger: EntityLogger | None = None, **kwargs) -> None:
        super().__init__(logger=logger, **kwargs)

    @override
    async def authenticate(self, **kwargs) -> None:
        await self.authenticate_azurerm()

    @override
    async def get_api_client(self) -> AzureClient:
        return AzureClient(self.environment_variables)

    @override
    async def is_valid(self) -> bool:
        azure_api_client = await self.get_api_client()
        await azure_api_client.get_azure_token()
        if azure_api_client.headers.get("Authorization"):
            return True

        raise CloudWrongCredentials("Failed to authenticate with Azure Resource Manager.")
