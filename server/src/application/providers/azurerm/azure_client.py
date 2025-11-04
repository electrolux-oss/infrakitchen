import json
import logging
from typing import Any

import httpx
import xmltodict

from core.errors import AccessUnauthorized, EntityExistsError, EntityNotFound

logger = logging.getLogger("azure_resource_manager_client")


class AzureClient:
    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.tenant_id = environment_variables.get("AZURE_TENANT_ID")
        self.client_id = environment_variables.get("AZURE_CLIENT_ID")
        self.client_secret = environment_variables.get("AZURE_CLIENT_SECRET")
        self.subscription_id = environment_variables.get("AZURE_SUBSCRIPTION_ID")

        if not self.tenant_id or not self.client_id or not self.client_secret:
            raise ValueError("No valid authentication method provided for Azure Resource Manager.")

        if not self.subscription_id:
            raise ValueError("No valid subscription ID provided for Azure.")

        self.base_url = f"https://management.azure.com/subscriptions/{self.subscription_id}"

        self.headers = {
            "Content-Type": "application/json",
        }

    async def _check_token(self) -> None:
        if not self.headers.get("Authorization"):
            await self.get_azure_token()

    async def get_azure_token(self) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token",
                data={
                    "client_id": self.client_id,
                    "scope": "https://management.azure.com/.default",
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                },
            )

        azure_token: dict[str, Any] = response.json()
        if not azure_token.get("access_token"):
            raise ValueError("Failed to get Azure token")

        self.headers.update(
            {
                "Authorization": f"Bearer {azure_token['access_token']}",
            }
        )

    @staticmethod
    def _error_handling(response: httpx.Response) -> None:
        if response.status_code == 403:
            raise AccessUnauthorized(f"Unauthorized {response.status_code}: {response.text}")
        elif response.status_code == 404:
            raise EntityNotFound(f"Not found: {response.text}")
        elif response.status_code == 409:
            raise EntityExistsError(f"Entity already exists: {response.text}")
        elif response.status_code in [201, 202]:
            pass
        elif response.status_code != 200:
            raise ValueError(f"Error {response.status_code}: {response.text}")

    async def make_response(self, response: httpx.Response) -> dict[str, Any]:
        self._error_handling(response)
        if response.status_code in [201, 202]:
            return {}
        json_result = response.json()
        return json_result

    async def get(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        await self._check_token()
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"GET URL: {self.base_url}/{path} with params: {params}")
            response = await client.get(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def head(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        await self._check_token()
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"HEAD URL: {self.base_url}/{path} with params: {params}")
            response = await client.head(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def post(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        await self._check_token()
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"POST URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.post(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def put(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        await self._check_token()
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"PUT URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.put(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def delete(self, path: str, params: dict[str, str] | None = None) -> dict[str, Any]:
        await self._check_token()
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"DELETE URL: {self.base_url}/{path} with params: {params}")
            response = await client.delete(f"{self.base_url}/{path}")
            return await self.make_response(response)


class AzureStorageClient(AzureClient):
    def __init__(self, environment_variables: dict[str, str], storage_account_name: str) -> None:
        super().__init__(environment_variables)
        self.storage_account_name: str = storage_account_name
        self.base_url: str = f"https://{self.storage_account_name}.blob.core.windows.net"

    @staticmethod
    def convert_keys_to_lowercase(obj: Any) -> Any:
        if isinstance(obj, dict):
            return {k.lower(): AzureStorageClient.convert_keys_to_lowercase(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [AzureStorageClient.convert_keys_to_lowercase(item) for item in obj]
        else:
            return obj

    async def make_response(self, response: httpx.Response) -> dict[str, Any]:
        self._error_handling(response)
        if response.status_code in [201, 202]:
            return {}
        xml_result = response.text
        if not xml_result:
            return {}
        json_result = json.loads(json.dumps(xmltodict.parse(xml_result)))
        json_result = self.convert_keys_to_lowercase(json_result)
        return json_result

    async def _check_token(self) -> None:
        if not self.headers.get("Authorization"):
            await self.get_blob_service_token()

    async def get_blob_service_token(self) -> None:
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token",
                data={
                    "client_id": self.client_id,
                    "scope": "https://storage.azure.com/.default",
                    "client_secret": self.client_secret,
                    "grant_type": "client_credentials",
                },
            )

        azure_token: dict[str, Any] = response.json()
        if not azure_token.get("access_token"):
            raise ValueError("Failed to get Azure token")

        self.headers.update({"Authorization": f"Bearer {azure_token['access_token']}", "x-ms-version": "2020-04-08"})
