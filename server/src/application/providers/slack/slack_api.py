from typing import Any

from core.caches.functions import cache_decorator
from .schema import SlackChannel, SlackUser
from .slack_client import SlackClient


class SlackApi(SlackClient):
    def __init__(self, environment_variables: dict[str, str]):
        super().__init__(environment_variables)

    async def auth_test(self) -> dict[str, Any]:
        response = await self.post("auth.test")
        if not response.values or not isinstance(response.values, dict):
            raise ValueError("Slack auth.test returned empty response")
        return response.values

    @cache_decorator(ttl=300)  # Cache for 5 minutes
    async def users_lookup_by_email(self, email: str) -> SlackUser:
        response = await self.get("users.lookupByEmail", params={"email": email})
        if not response.values or not isinstance(response.values, dict):
            raise ValueError("Slack users.lookupByEmail returned empty response")

        user = response.values.get("user")
        if not user or not isinstance(user, dict):
            raise ValueError("Slack users.lookupByEmail response does not include a user object")

        return SlackUser.model_validate(user)

    async def post_message(self, channel: str, text: str) -> dict[str, Any]:
        response = await self.post(
            "chat.postMessage",
            data={
                "channel": channel,
                "text": text,
            },
        )
        if not response.values or not isinstance(response.values, dict):
            raise ValueError("Slack chat.postMessage returned empty response")
        return response.values

    @cache_decorator(ttl=60)  # Cache for 1 minute
    async def list_channels(self) -> list[SlackChannel]:
        response = await self.get(
            "conversations.list",
            params={
                "types": "public_channel,private_channel",
                "exclude_archived": "true",
                "limit": "1000",
            },
        )
        if not response.values or not isinstance(response.values, dict):
            raise ValueError("Slack conversations.list returned empty response")

        channels = response.values.get("channels")
        if not channels:
            return []
        if not isinstance(channels, list):
            raise ValueError("Slack conversations.list response has invalid channels payload")

        return [SlackChannel.model_validate(channel) for channel in channels]
