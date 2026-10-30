import uuid

import strawberry
from strawberry.types import Info

from application.service_builds.dependencies import get_service_build_service
from application.service_builds.service import ServiceBuildService
from graphql_api.helpers import IsAuthenticated, check_api_permission, parse_range
from graphql_api.modules.service_build.types import ServiceBuildType


def _build_service(info: Info) -> ServiceBuildService:
    return get_service_build_service(info.context["session"])


@strawberry.type
class ServiceBuildQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def service_builds(
        self,
        info: Info,
        service_id: uuid.UUID,
        commit_shas: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[ServiceBuildType]:
        await check_api_permission(info, "service", ["read"])
        return await _build_service(info).get_builds(service_id, commit_shas=commit_shas, range=parse_range(range))

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def service_builds_count(self, info: Info, service_id: uuid.UUID) -> int:
        await check_api_permission(info, "service", ["read"])
        return await _build_service(info).count_builds(service_id)
