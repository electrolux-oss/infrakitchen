import logging
from typing import Any

import httpx
from pydantic import BaseModel

from core.errors import AccessUnauthorized, CloudWrongCredentials, EntityExistsError, EntityNotFound

logger = logging.getLogger("azure_devops_client")


class AzureDevopsResponse(BaseModel):
    """
    Base model for GitHub API responses.
    """

    values: list[Any] | dict[str, Any] | None = None
    headers: dict[str, str] = {}
    status_code: int | None = None


class AzureDevopsClient:
    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.base_url: str = "https://dev.azure.com"
        self.azure_devops_token: str | None = environment_variables.get("AZURE_TOKEN")
        self.azure_organization: str | None = environment_variables.get("AZURE_ORGANIZATION")

        if not self.azure_devops_token:
            raise ValueError("No valid authentication method provided for AzureDevopsClient.")

        if not self.azure_organization:
            raise ValueError("No valid Azure organization provided for AzureDevopsClient.")

        self.headers: dict[str, str] = {
            "Authorization": f"Bearer {self.azure_devops_token}",
        }

    @staticmethod
    def _error_handling(response: httpx.Response) -> None:
        if response.status_code == 403:
            raise AccessUnauthorized(f"Unauthorized {response.status_code}: {response.text}")
        elif response.status_code == 401:
            raise CloudWrongCredentials(
                "Wrong credentials", metadata=[{"status_code": response.status_code, "cloud_response": response.text}]
            )
        elif response.status_code == 404:
            raise EntityNotFound(f"Not found: {response.text}")
        elif response.status_code == 409:
            raise EntityExistsError(f"Entity already exists: {response.text}")
        elif response.status_code == 422:
            raise ValueError(f"Unprocessable Entity: {response.text}")
        elif response.status_code in [201, 202]:
            pass
        elif response.status_code != 200:
            raise ValueError(f"Error {response.status_code}: {response.text}")

    async def make_response(self, response: httpx.Response) -> AzureDevopsResponse:
        self._error_handling(response)
        if response.status_code in [201, 202]:
            return AzureDevopsResponse(values=None, headers=dict(response.headers), status_code=response.status_code)
        json_result = response.json()
        if json_result.get("value") is not None:
            return AzureDevopsResponse(
                values=json_result["value"], headers=dict(response.headers), status_code=response.status_code
            )

        return AzureDevopsResponse(values=json_result, headers=dict(response.headers), status_code=response.status_code)

    async def get(self, path: str, params: dict[str, str] | None = None) -> AzureDevopsResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"GET URL: {self.base_url}/{self.azure_organization}/{path} with params: {params}")
            response = await client.get(f"{self.base_url}/{self.azure_organization}/{path}")
            return await self.make_response(response)

    async def post(self, path: str, data: dict[str, Any] | None = None) -> AzureDevopsResponse:
        async with httpx.AsyncClient(headers=self.headers) as client:
            logger.debug(f"POST URL: {self.base_url}/{self.azure_organization}/{path} with data: {data}")
            response = await client.post(f"{self.base_url}/{self.azure_organization}/{path}", json=data)
            return await self.make_response(response)

    async def patch(self, path: str, data: dict[str, Any] | None = None) -> AzureDevopsResponse:
        async with httpx.AsyncClient(headers=self.headers) as client:
            logger.debug(f"PATCH URL: {self.base_url}/{self.azure_organization}/{path} with data: {data}")
            response = await client.patch(f"{self.base_url}/{self.azure_organization}/{path}", json=data)
            return await self.make_response(response)
