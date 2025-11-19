import logging
from typing import Any

import httpx
import base64
from pydantic import BaseModel

from core.errors import AccessUnauthorized, CloudWrongCredentials, EntityExistsError, EntityNotFound

logger = logging.getLogger("bitbucket_client")


class BitbucketResponse(BaseModel):
    """
    Base model for GitHub API responses.
    """

    values: list[Any] | None = None
    headers: dict[str, str] = {}
    status_code: int | None = None
    pagelen: int | None = None
    page: int | None = None
    size: int | None = None


class BitbucketClient:
    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.base_url: str = "https://api.bitbucket.org/2.0"
        self.bitbucket_user: str | None = None
        self.bitbucket_key: str | None = None
        self.bitbucket_api_key: str | None = None
        self.auth: tuple[str, str] | None = None

        if "BITBUCKET_USER" in environment_variables and "BITBUCKET_KEY" in environment_variables:
            self.bitbucket_user = environment_variables["BITBUCKET_USER"]
            self.bitbucket_key = environment_variables["BITBUCKET_KEY"]
            self.auth = (self.bitbucket_user, self.bitbucket_key)
        elif "BITBUCKET_API_KEY" in environment_variables:
            self.bitbucket_api_key = environment_variables["BITBUCKET_API_KEY"]
        else:
            raise ValueError("No valid authentication method provided for BitbucketClient.")

        self.headers: dict[str, str] = {"Accept": "application/json"}
        if self.bitbucket_api_key:
            self.headers.update(
                {"Authorization": f"Basic {base64.b64encode(self.bitbucket_api_key.encode()).decode()}"}
            )

    @staticmethod
    def _error_handling(response: httpx.Response) -> None:
        if response.status_code == 403:
            raise AccessUnauthorized(f"Unauthorized {response.status_code}: {response.text}")
        elif response.status_code == 401:
            raise CloudWrongCredentials(
                "Wrong credentials", metadata=[{"response_text": response.text, "status_code": response.status_code}]
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

    async def make_response(self, response: httpx.Response) -> BitbucketResponse:
        self._error_handling(response)
        if response.status_code in [201, 202]:
            return BitbucketResponse(values=None, headers=dict(response.headers), status_code=response.status_code)
        json_result: dict[str, Any] = response.json()
        if json_result.get("values") is not None:
            bb_response = BitbucketResponse.model_validate(json_result)
        else:
            bb_response = BitbucketResponse(values=[json_result])
        bb_response.headers = dict(response.headers)
        bb_response.status_code = response.status_code
        return bb_response

    async def get(self, path: str, params: dict[str, str] | None = None) -> BitbucketResponse:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers, params=params) as client:
            logger.debug(f"GET URL: {self.base_url}/{path} with params: {params}")
            response = await client.get(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def head(self, path: str, params: dict[str, str] | None = None) -> BitbucketResponse:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers, params=params) as client:
            logger.debug(f"HEAD URL: {self.base_url}/{path} with params: {params}")
            response = await client.head(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def post(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> BitbucketResponse:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers, params=params) as client:
            logger.debug(f"POST URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.post(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def patch(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> BitbucketResponse:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers, params=params) as client:
            logger.debug(f"PATCH URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.patch(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def put(
        self, path: str, params: dict[str, str] | None = None, data: dict[str, Any] | None = None
    ) -> BitbucketResponse:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers, params=params) as client:
            logger.debug(f"PUT URL: {self.base_url}/{path} with params: {params}, data: {data}")
            response = await client.put(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)

    async def delete(self, path: str, params: dict[str, str] | None = None) -> BitbucketResponse:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers, params=params) as client:
            logger.debug(f"DELETE URL: {self.base_url}/{path} with params: {params}")
            response = await client.delete(f"{self.base_url}/{path}")
            return await self.make_response(response)
