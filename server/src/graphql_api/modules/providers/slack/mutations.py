import uuid

import strawberry
from strawberry.types import Info

from application.providers.slack.slack_provider import get_slack_client
from core.errors import EntityNotFound
from core.users.dependencies import get_user_service
from core.users.functions import user_is_super_admin
from core.users.schema import UserMetadata
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.user.types import UserType


@strawberry.type
class SlackMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def map_user_email_to_slack_id(
        self,
        info: Info,
        integration_id: uuid.UUID | None = None,
        user_id: uuid.UUID | None = None,
    ) -> UserType:
        requester = info.context["request"].state.user
        if not requester:
            raise PermissionError("Access denied")

        user_service = get_user_service(session=info.context["session"])

        email: str | None = None
        # Only super admins can map Slack IDs for other users. Regular users can only map their own Slack ID.
        if user_id and requester.id != user_id:
            if not await user_is_super_admin(requester):
                raise PermissionError("Access denied")
            user = await user_service.get_by_id(user_id)
            if not user:
                raise EntityNotFound("User not found")
            email = user.email
        else:
            email = requester.email
            user_id = requester.id

        if email is None:
            raise ValueError("Email is required for mapping Slack ID")

        if user_id is None:
            raise ValueError("User ID is required for mapping Slack ID")

        slack_client = await get_slack_client(integration_id, info.context["session"])
        slack_user = await slack_client.users_lookup_by_email(email=email)

        return await user_service.update_user_meta(user_id, UserMetadata(slack_id=slack_user.id))
