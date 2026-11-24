import logging
from typing import Any

import httpx

from core.errors import AccessUnauthorized

logger = logging.getLogger("cloudflare_client")

CLOUDFLARE_API_URL = "https://api.cloudflare.com/client/v4"


class CloudflareClient:
    def __init__(self, api_token: str, base_url: str = CLOUDFLARE_API_URL, timeout: float = 15.0):
        if not api_token:
            raise ValueError("No API token provided for Cloudflare.")
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {api_token}",
        }

    async def get(self, path: str) -> dict[str, Any]:
        async with httpx.AsyncClient(headers=self.headers, timeout=self.timeout) as client:
            response = await client.get(f"{self.base_url}/{path.lstrip('/')}")
        try:
            body: dict[str, Any] = response.json()
        except ValueError:
            body = {}
        if response.status_code in (401, 403) or not body.get("success", False):
            errors = body.get("errors") or response.text
            raise AccessUnauthorized(f"Cloudflare API error {response.status_code}: {errors}")
        return body

    async def verify_token(self, account_id: str | None = None) -> dict[str, Any]:
        """Verify the API token and return its details (id, status, expires_on).

        Account-owned tokens can only be verified through the account endpoint, user tokens only
        through the user endpoint. With an account ID the account endpoint is tried first.
        """
        if account_id:
            try:
                return (await self.get(f"accounts/{account_id}/tokens/verify"))["result"]
            except AccessUnauthorized as e:
                logger.debug(f"Account token verification failed, trying user token verification: {e}")
        return (await self.get("user/tokens/verify"))["result"]
