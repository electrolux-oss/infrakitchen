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
    def _parse_error_body(response: httpx.Response) -> Any:
        try:
            return response.json()
        except ValueError:
            return response.text

    @staticmethod
    def _raise_with_metadata(exc_cls: type[Exception], message: str, response: httpx.Response) -> None:
        body = GithubClient._parse_error_body(response)
        metadata = [body] if isinstance(body, dict) else [{"response": body}]
        exc = exc_cls(message)
        setattr(exc, "metadata", metadata)
        raise exc

    @staticmethod
    def _error_handling(response: httpx.Response) -> None:
        if response.status_code == 403:
            GithubClient._raise_with_metadata(AccessUnauthorized, "Access denied by GitHub", response)
        elif response.status_code == 404:
            GithubClient._raise_with_metadata(EntityNotFound, "GitHub resource not found", response)
        elif response.status_code == 409:
            GithubClient._raise_with_metadata(EntityExistsError, "GitHub resource already exists", response)
        elif response.status_code == 422:
            GithubClient._raise_with_metadata(
                ValueError, "GitHub rejected the request (unprocessable entity)", response
            )
        elif response.status_code in [201, 202]:
            pass
        elif response.status_code != 200:
            GithubClient._raise_with_metadata(
                ValueError, f"GitHub API request failed ({response.status_code})", response
            )

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
