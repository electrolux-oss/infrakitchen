from typing import Any
from .azure_client import AzureStorageClient


class AzureStorage(AzureStorageClient):
    def __init__(self, environment_variables: dict[str, Any], storage_account_name: str) -> None:
        super().__init__(environment_variables, storage_account_name)

    async def list_containers(self) -> dict[str, Any]:
        result = await self.get(
            "",
            params={
                "api-version": "2023-05-01",
                "comp": "list",
            },
        )
        return result

    async def container_exists(self, container_name: str) -> dict[str, Any]:
        result = await self.head(
            f"{container_name}",
            params={
                "api-version": "2023-05-01",
                "restype": "container",
                "comp": "metadata",
            },
        )
        return result

    async def create_container(self, container_name: str) -> dict[str, Any]:
        result = await self.put(
            f"{container_name}",
            params={
                "api-version": "2023-05-01",
                "restype": "container",
            },
        )
        return result

    async def delete_container(self, container_name: str) -> dict[str, Any]:
        result = await self.delete(
            f"{container_name}",
            params={
                "api-version": "2023-05-01",
                "restype": "container",
            },
        )
        return result
