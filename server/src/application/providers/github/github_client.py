import logging
from typing import Any

import httpx
from pydantic import BaseModel

from core.errors import AccessUnauthorized, EntityExistsError, EntityNotFound

logger = logging.getLogger("github_client")


class GithubResponse(BaseModel):
    """
    Base model for GitHub API responses.
    """

    values: list[Any] | dict[str, Any] | None = None
    headers: dict[str, str] = {}
    status_code: int | None = None


class GithubClient:
    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.base_url: str = "https://api.github.com"
        self.github_token: str | None = environment_variables.get("GITHUB_TOKEN")

        if not self.github_token:
            raise ValueError("No valid authentication method provided for GithubClient.")

        self.headers: dict[str, str] = {
            "Authorization": f"Bearer {self.github_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        }

    @staticmethod
    def _error_handling(response: httpx.Response) -> None:
        if response.status_code == 403:
            raise AccessUnauthorized(f"Unauthorized {response.status_code}: {response.text}")
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

    async def make_response(self, response: httpx.Response) -> GithubResponse:
        self._error_handling(response)
        if response.status_code in [201, 202]:
            return GithubResponse(values=None, headers=dict(response.headers), status_code=response.status_code)
        json_result = response.json()
        return GithubResponse(values=json_result, headers=dict(response.headers), status_code=response.status_code)

    async def get(self, path: str, params: dict[str, str] | None = None) -> GithubResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"GET URL: {self.base_url}/{path} with params: {params}")
            response = await client.get(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def head(self, path: str, params: dict[str, str] | None = None) -> GithubResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"HEAD URL: {self.base_url}/{path} with params: {params}")
            response = await client.head(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def post(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> GithubResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"POST URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.post(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def patch(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> GithubResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"PATCH URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.patch(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def put(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> GithubResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"PUT URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.put(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def delete(self, path: str, params: dict[str, str] | None = None) -> GithubResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params) as client:
            logger.debug(f"DELETE URL: {self.base_url}/{path} with params: {params}")
            response = await client.delete(f"{self.base_url}/{path}")
            return await self.make_response(response)
