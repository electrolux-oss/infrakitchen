import logging

import httpx
from typing import Any

from core.errors import (
    AccessDenied,
    CloudExecutionError,
    CloudWrongCredentials,
    EntityExistsError,
    EntityNotFound,
    EntityValueError,
)

logger = logging.getLogger("mongodb_atlas_client")


class MongoAtlasClient:
    def __init__(self, environment_variables: dict[str, str]):
        self.base_url = "https://cloud.mongodb.com/api/atlas/v2"
        if not environment_variables.get("MONGODB_ATLAS_PUBLIC_KEY") or not environment_variables.get(
            "MONGODB_ATLAS_PRIVATE_KEY"
        ):
            raise ValueError("No valid authentication method provided for MongoDB Atlas.")
        self.auth = httpx.DigestAuth(
            environment_variables["MONGODB_ATLAS_PUBLIC_KEY"],
            environment_variables["MONGODB_ATLAS_PRIVATE_KEY"],
        )

        self.headers = {
            "Accept": "application/vnd.atlas.2023-02-01+json",
            "Content-Type": "application/json",
        }
        self.organization_id = environment_variables.get("MONGODB_ATLAS_ORG_ID")

    @staticmethod
    def _error_handling(response):
        if response.get("error"):
            if response["error"] == 404:
                raise EntityNotFound(response)
            elif response["error"] == 400:
                raise EntityValueError(response)
            elif response["error"] == 409:
                raise EntityExistsError(response)
            elif response["error"] == 401:
                raise CloudWrongCredentials("Unauthorized access to MongoDB Atlas", metadata=[response])
            elif response["error"] == 403:
                raise AccessDenied(response)
            elif response["error"] == 500:
                raise CloudExecutionError(response)

    async def get(self, path) -> dict[str, Any]:
        async with httpx.AsyncClient(auth=self.auth, headers=self.headers) as client:
            response = await client.get(f"{self.base_url}/{path}")
            json_result = response.json()
            self._error_handling(json_result)
            return json_result

    async def get_organizations(self) -> list[dict[str, str]]:
        result = await self.get("orgs")
        return result.get("results", [])

    async def get_projects(self) -> list[dict[str, str]]:
        result = await self.get("groups")
        return result.get("results", [])
