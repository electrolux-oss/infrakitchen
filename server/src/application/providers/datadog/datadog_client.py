import logging
from typing import Any

import httpx

from core.errors import AccessUnauthorized, EntityExistsError, EntityNotFound

logger = logging.getLogger("datadog_client")


class DatadogClient:
    def __init__(self, environment_variables: dict[str, str]):
        self.base_url = environment_variables.get("DD_HOST")
        if not (environment_variables.get("DD_API_KEY") or environment_variables.get("DD_APP_KEY")):
            raise ValueError("No valid authentication method provided for Datadog.")

        self.headers = {
            "Accept": "application/json",
        }
        if environment_variables.get("DD_API_KEY"):
            self.headers["DD-API-KEY"] = environment_variables["DD_API_KEY"]
        if environment_variables.get("DD_APP_KEY"):
            self.headers["DD-APPLICATION-KEY"] = environment_variables["DD_APP_KEY"]

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

    async def get(self, path) -> dict[str, Any]:
        async with httpx.AsyncClient(headers=self.headers) as client:
            response = await client.get(f"{self.base_url}/{path}")
            self._error_handling(response)
            json_result = response.json()
            return json_result
