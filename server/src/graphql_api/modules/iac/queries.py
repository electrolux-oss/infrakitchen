import uuid

import strawberry
from strawberry.types import Info

from application.iac.dependencies import get_iac_service
from application.iac.service import IacService
from graphql_api.helpers import IsAuthenticated, check_api_permission, parse_range
from graphql_api.modules.iac.types import IacEnvironmentConfigType, IacRunType


def _build_service(info: Info) -> IacService:
    return get_iac_service(session=info.context["session"])


@strawberry.type
class IacQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def iac_environment_configs(self, info: Info, source_code_id: uuid.UUID) -> list[IacEnvironmentConfigType]:
        """How each environment of an IaC repository is run."""
        await check_api_permission(info, "source_code", ["read"])
        return await _build_service(info).get_environment_configs(source_code_id)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def iac_runs(
        self,
        info: Info,
        source_code_id: uuid.UUID,
        module_path: str | None = None,
        environment_name: str | None = None,
        region: str | None = None,
        range: list[int] | None = None,
    ) -> list[IacRunType]:
        """Runs of an IaC repository, newest first; of one module, environment and/or region when given."""
        await check_api_permission(info, "source_code", ["read"])
        return await _build_service(info).get_runs(
            source_code_id,
            module_path=module_path,
            environment_name=environment_name,
            region=region,
            range=parse_range(range),
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def iac_runs_count(
        self,
        info: Info,
        source_code_id: uuid.UUID,
        module_path: str | None = None,
        environment_name: str | None = None,
        region: str | None = None,
    ) -> int:
        await check_api_permission(info, "source_code", ["read"])
        return await _build_service(info).count_runs(
            source_code_id, module_path=module_path, environment_name=environment_name, region=region
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def iac_latest_runs(self, info: Info, source_code_id: uuid.UUID) -> list[IacRunType]:
        """The newest run of every module and environment."""
        await check_api_permission(info, "source_code", ["read"])
        return await _build_service(info).get_latest_runs(source_code_id)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def iac_run(self, info: Info, id: uuid.UUID) -> IacRunType | None:
        await check_api_permission(info, "source_code", ["read"])
        return await _build_service(info).get_run(id)
