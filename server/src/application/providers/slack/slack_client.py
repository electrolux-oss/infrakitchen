import logging
from typing import Any

import httpx
from pydantic import BaseModel

from core.errors import AccessUnauthorized, EntityExistsError, EntityNotFound

logger = logging.getLogger("slack_client")


class SlackResponse(BaseModel):
    values: list[Any] | dict[str, Any] | None = None
    headers: dict[str, str] = {}
    status_code: int | None = None


class SlackClient:
    def __init__(self, environment_variables: dict[str, str]) -> None:
        self.base_url: str = "https://slack.com/api"
        self.slack_bot_token: str | None = environment_variables.get("SLACK_BOT_TOKEN")

        if not self.slack_bot_token:
            raise ValueError("No valid authentication method provided for SlackClient.")

        self.headers: dict[str, str] = {
            "Authorization": f"Bearer {self.slack_bot_token}",
            "Accept": "application/json",
            "Content-Type": "application/json; charset=utf-8",
        }

    @staticmethod
    def _http_error_handling(response: httpx.Response) -> None:
        if response.status_code == 401:
            raise AccessUnauthorized(f"Unauthorized {response.status_code}: {response.text}")
        if response.status_code == 403:
            raise AccessUnauthorized(f"Forbidden {response.status_code}: {response.text}")
        if response.status_code == 404:
            raise EntityNotFound(f"Not found: {response.text}")
        if response.status_code == 409:
            raise EntityExistsError(f"Entity already exists: {response.text}")
        if response.status_code in (200, 201, 202):
            return
        raise ValueError(f"Error {response.status_code}: {response.text}")

    @staticmethod
    def _slack_error_handling(payload: dict[str, Any]) -> None:
        if payload.get("ok"):
            return

        error_code = payload.get("error", "unknown_error")
        if error_code in {"invalid_auth", "not_authed", "account_inactive", "token_revoked"}:
            raise AccessUnauthorized(f"Slack authorization failed: {error_code}")
        if error_code in {"users_not_found", "channel_not_found"}:
            raise EntityNotFound(f"Slack entity not found: {error_code}")
        raise ValueError(f"Slack API error: {error_code}")

    async def make_response(self, response: httpx.Response) -> SlackResponse:
        self._http_error_handling(response)
        json_result: dict[str, Any] = response.json()
        self._slack_error_handling(json_result)
        return SlackResponse(
            values=json_result,
            headers=dict(response.headers),
            status_code=response.status_code,
        )

    async def get(self, path: str, params: dict[str, Any] | None = None) -> SlackResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params, timeout=10) as client:
            logger.debug("GET URL: %s/%s with params: %s", self.base_url, path, params)
            response = await client.get(f"{self.base_url}/{path}")
            return await self.make_response(response)

    async def post(
        self,
        path: str,
        params: dict[str, Any] | None = None,
        data: dict[str, Any] | None = None,
    ) -> SlackResponse:
        async with httpx.AsyncClient(headers=self.headers, params=params, timeout=10) as client:
            logger.debug("POST URL: %s/%s with params: %s", self.base_url, path, params)
            response = await client.post(f"{self.base_url}/{path}", json=data)
            return await self.make_response(response)