import uuid

import strawberry
from strawberry.types import Info

from application.providers.slack.slack_provider import get_slack_client
from graphql_api.helpers import IsAuthenticated
from .types import SlackChannelType, SlackUserType


@strawberry.type
class SlackQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def slack_channels(
        self,
        info: Info,
        integration_id: uuid.UUID | None = None,
    ) -> list[SlackChannelType]:
        slack_client = await get_slack_client(integration_id, info.context["session"])
        channels = await slack_client.list_channels()
        return [
            SlackChannelType(
                id=ch.id,
                name=ch.name,
                is_channel=ch.is_channel,
                is_private=ch.is_private,
                is_member=ch.is_member,
                num_members=ch.num_members,
            )
            for ch in channels
        ]

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def slack_user_by_email(
        self,
        info: Info,
        email: str,
        integration_id: uuid.UUID | None = None,
    ) -> SlackUserType:
        slack_client = await get_slack_client(integration_id, info.context["session"])
        user = await slack_client.users_lookup_by_email(email=email)
        return SlackUserType(
            id=user.id,
            name=user.name,
            real_name=user.real_name,
            is_bot=user.is_bot,
            deleted=user.deleted,
            tz=user.tz,
        )
