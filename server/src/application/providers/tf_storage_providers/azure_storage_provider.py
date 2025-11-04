import logging
from typing import Any, override

from core import StorageProviderAdapter
from core.custom_entity_log_controller import EntityLogger
from core.errors import EntityNotFound

from ...storages.model import AzureRMStorageConfig
from ..azurerm import AzureResourceGroup, AzureStorage, AzureStorageAccount

logger = logging.getLogger("azure_tf_backend_provider")


class AzurermStorage:
    environment_variables: dict[str, str]
    configuration: AzureRMStorageConfig

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        self.logger: EntityLogger = logger
        self.environment_variables: dict[str, str] = kwargs.get("environment_variables", {})

        configuration = kwargs.get("configuration")
        if not isinstance(configuration, AzureRMStorageConfig):
            raise ValueError("No configuration provided for AzureRM backend provider.")

        self.configuration = configuration
        self.azurerm_resource_group: dict[str, Any] | None = None

        if not self.configuration.azurerm_resource_group_name:
            raise ValueError("No resource group name provided for AzureRM backend provider.")

        if not self.configuration.azurerm_storage_account_name:
            raise ValueError("No storage account name provided for AzureRM backend provider.")

        if not self.configuration.azurerm_container_name:
            raise ValueError("No container name provided for AzureRM backend provider.")

        self.azure_storage_account_client: AzureStorageAccount = AzureStorageAccount(self.environment_variables)
        self.azure_storage_client: AzureStorage = AzureStorage(
            self.environment_variables, self.configuration.azurerm_storage_account_name
        )

    async def _get_azurerm_resource_group(self):
        azurerm_resource_group_client = AzureResourceGroup(environment_variables=self.environment_variables)
        self.azurerm_resource_group = await azurerm_resource_group_client.get_resource_group(
            self.configuration.azurerm_resource_group_name
        )
        if not self.azurerm_resource_group and not self.azurerm_resource_group.get("location"):
            raise Exception(f"AzureRM resource group {self.configuration.azurerm_resource_group_name} not found")

    async def _create_azure_storage_account(self):
        self.logger.info("Creating AzureRM storage account")
        storage_account_exists = False

        try:
            _ = await self.azure_storage_account_client.get_storage_account(
                self.configuration.azurerm_resource_group_name,
                self.configuration.azurerm_storage_account_name,
            )
            storage_account_exists = True
            self.logger.info("AzureRM storage account exists. Skipping creation...")
        except EntityNotFound:
            self.logger.info("AzureRM storage account not found. Creating...")

        if not storage_account_exists:
            self.logger.info("Creating AzureRM storage account")

            azurerm_resource_group_client = AzureResourceGroup(environment_variables=self.environment_variables)
            azurerm_resource_group = await azurerm_resource_group_client.get_resource_group(
                self.configuration.azurerm_resource_group_name
            )
            if not azurerm_resource_group and not azurerm_resource_group.get("location"):
                raise Exception(f"AzureRM resource group {self.configuration.azurerm_resource_group_name} not found")

            result = await self.azure_storage_account_client.create_storage_account(
                self.configuration.azurerm_resource_group_name,
                self.configuration.azurerm_storage_account_name,
                location=azurerm_resource_group["location"],
            )
            if isinstance(result, dict):
                self.logger.info(f"Created AzureRM storage account {result}")
            else:
                self.logger.error(f"Failed to create AzureRM storage account {result}")
                raise Exception(f"Failed to create AzureRM storage account {result}")

    async def _create_azure_storage_container(self):
        self.logger.info("Creating AzureRM storage container")
        storage_container_exists = False

        try:
            _ = await self.azure_storage_client.container_exists(self.configuration.azurerm_container_name)
            storage_container_exists = True
            self.logger.info("Azure Storage container exists. Skipping creation...")
        except EntityNotFound:
            self.logger.info("Azure Storage container not found. Creating...")

        if not storage_container_exists:
            result = await self.azure_storage_client.create_container(self.configuration.azurerm_container_name)
            if isinstance(result, dict):
                self.logger.info(f"Created Azure Storage container {result}")
            else:
                self.logger.error(f"Failed to create Azure Storage container {result}")
                raise Exception(f"Failed to create Azure Storage container {result}")

    async def _destroy_azure_storage_container(self):
        self.logger.info("Destroying AzureRM storage container")
        storage_container_exists = False

        try:
            _ = await self.azure_storage_client.container_exists(self.configuration.azurerm_container_name)
            storage_container_exists = True
            self.logger.info("Azure Storage container exists. Deleting...")
        except EntityNotFound:
            self.logger.info("Azure Storage container not found. Skipping deletion...")

        if storage_container_exists:
            result = await self.azure_storage_client.delete_container(self.configuration.azurerm_container_name)
            if isinstance(result, dict):
                self.logger.info(f"Deleted Azure Storage container {result}")
            else:
                self.logger.error(f"Failed to delete Azure Storage container {result}")
                raise Exception(f"Failed to delete Azure Storage container {result}")

    async def _destroy_azure_storage_account(self):
        self.logger.info("Destroying AzureRM storage account")
        storage_account_exists = False

        try:
            _ = await self.azure_storage_account_client.get_storage_account(
                self.configuration.azurerm_resource_group_name,
                self.configuration.azurerm_storage_account_name,
            )
            storage_account_exists = True
            self.logger.info("AzureRM storage account exists. Deleting...")
        except EntityNotFound:
            self.logger.info("AzureRM storage account not found. Skipping deletion...")

        if storage_account_exists:
            containers = await self.azure_storage_client.list_containers()
            if containers.get("enumerationresults") and containers["enumerationresults"].get("containers"):
                raise Exception(
                    f"Cannot delete AzureRM storage account \
                        {self.configuration.azurerm_storage_account_name}  \
                        because it has containers {containers['enumerationresults']['containers']}"
                )
            result = await self.azure_storage_account_client.delete_storage_account(
                self.configuration.azurerm_resource_group_name,
                self.configuration.azurerm_storage_account_name,
            )
            if isinstance(result, dict):
                self.logger.info(f"Deleted AzureRM storage account {result}")
            else:
                self.logger.error(f"Failed to delete AzureRM storage account {result}")
                raise Exception(f"Failed to delete AzureRM storage account {result}")


class AzurermTfStorage(StorageProviderAdapter, AzurermStorage):
    __cloud_backend_provider_adapter_name__: str = "azurerm"

    def __init__(self, logger: EntityLogger, **kwargs) -> None:
        super().__init__(logger, **kwargs)

    @override
    async def create(self) -> None:
        await self._get_azurerm_resource_group()
        await self._create_azure_storage_account()
        await self._create_azure_storage_container()

    @override
    async def destroy(self) -> None:
        await self._destroy_azure_storage_container()
        await self._destroy_azure_storage_account()
