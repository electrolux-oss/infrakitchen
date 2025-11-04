from typing import Any
from .azure_client import AzureClient


class AzureStorageAccount(AzureClient):
    def __init__(self, environment_variables: dict[str, Any]):
        super().__init__(environment_variables)

    async def get_storage_accounts(self) -> list[dict[str, Any]]:
        result = await self.get("/providers/Microsoft.Storage/storageAccounts", params={"api-version": "2023-05-01"})
        if result.get("value"):
            return result["value"]
        return []

    async def get_storage_account(self, resource_group: str, storage_account_name: str) -> dict[str, Any]:
        result = await self.get(
            f"/resourceGroups/{resource_group}/providers/Microsoft.Storage/storageAccounts/{storage_account_name}",
            params={"api-version": "2024-01-01"},
        )
        return result

    async def get_storage_accounts_by_resource_group(self, resource_group: str) -> list[dict[str, Any]]:
        result = await self.get(
            f"/resourceGroups/{resource_group}/providers/Microsoft.Storage/storageAccounts",
            params={"api-version": "2023-05-01"},
        )
        if result.get("value"):
            return result["value"]
        return []

    async def get_storage_account_keys(self, resource_group: str, storage_account_name: str) -> list[dict[str, Any]]:
        result = await self.post(
            f"/resourceGroups/{resource_group}/providers/Microsoft.Storage/storageAccounts/{storage_account_name}/listKeys",
            params={"api-version": "2023-05-01"},
        )
        if result.get("keys"):
            return result["keys"]
        return []

    async def create_storage_account(
        self, resource_group: str, storage_account_name: str, location: str = "eastus"
    ) -> dict[str, Any]:
        params = {
            "api-version": "2023-05-01",
        }

        data = {
            "location": location,
            "sku": {
                "name": "Standard_LRS",
                "tier": "Standard",
            },
            "kind": "StorageV2",
            "properties": {
                "accessTier": "Hot",
            },
        }

        result = await self.put(
            f"/resourceGroups/{resource_group}/providers/Microsoft.Storage/storageAccounts/{storage_account_name}",
            params=params,
            data=data,
        )
        return result

    async def delete_storage_account(self, resource_group: str, storage_account_name: str) -> dict[str, Any]:
        result = await self.delete(
            f"/resourceGroups/{resource_group}/providers/Microsoft.Storage/storageAccounts/{storage_account_name}",
            params={"api-version": "2023-05-01"},
        )
        return result
