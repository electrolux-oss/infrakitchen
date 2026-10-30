import uuid

import strawberry
from strawberry.types import Info

from application.service_builds.dependencies import get_service_build_service
from application.services.dependencies import get_service_service
from core.constants.model import ModelActions
from core.errors import AccessDenied
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.service_build.types import ServiceBuildType


@strawberry.type
class ServiceBuildMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def build_service(self, info: Info, service_id: uuid.UUID, commit_sha: str) -> ServiceBuildType:
        session = info.context["session"]
        requester = info.context["request"].state.user

        actions = await get_service_service(session).get_actions(service_id=service_id, requester=requester)
        if ModelActions.BUILD not in actions:
            raise AccessDenied(f"Access denied for action {ModelActions.BUILD.value}")

        return await get_service_build_service(session).create_build(
            service_id=service_id, commit_sha=commit_sha, requester=requester
        )
