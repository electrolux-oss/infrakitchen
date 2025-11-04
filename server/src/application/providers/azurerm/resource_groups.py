from typing import Any
from .azure_client import AzureClient


class AzureResourceGroup(AzureClient):
    def __init__(self, environment_variables: dict[str, Any]):
        super().__init__(environment_variables)

    async def get_resource_groups(self) -> list[dict[str, Any]]:
        result = await self.get("resourceGroups", params={"api-version": "2021-04-01"})
        if result.get("value"):
            return result["value"]
        return []

    async def get_resource_group(self, resource_group: str) -> dict[str, Any]:
        result = await self.get(f"resourceGroups/{resource_group}", params={"api-version": "2021-04-01"})
        return result
