import uuid

import strawberry
from strawberry.scalars import JSON
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from application.iac.dependencies import get_iac_service
from application.iac.model import DEFAULT_STATE_PATH_TEMPLATE
from application.iac.schema import IacEnvironmentConfigCreate, IacEnvironmentConfigUpdate, IacPlanCreate
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.iac.types import IacEnvironmentConfigType, IacRunType


@strawberry_pydantic.input(model=IacEnvironmentConfigCreate, all_fields=False)
class IacEnvironmentConfigCreateInput:
    name: str = strawberry.UNSET
    integration_ids: list[uuid.UUID] = strawberry.field(default_factory=list)
    storage_id: uuid.UUID | None = None
    state_path_template: str = DEFAULT_STATE_PATH_TEMPLATE
    tool_id: uuid.UUID | None = None
    regions: list[str] = strawberry.field(default_factory=list)
    region_variable: str | None = None
    variables: JSON = strawberry.field(default_factory=dict)
    region_variables: JSON = strawberry.field(default_factory=dict)


@strawberry_pydantic.input(model=IacEnvironmentConfigUpdate, all_fields=False)
class IacEnvironmentConfigUpdateInput:
    integration_ids: list[uuid.UUID] | None = None
    storage_id: uuid.UUID | None = None
    clear_storage: bool = False
    state_path_template: str | None = None
    tool_id: uuid.UUID | None = None
    clear_tool: bool = False
    regions: list[str] | None = None
    region_variable: str | None = None
    variables: JSON | None = None
    region_variables: JSON | None = None


@strawberry_pydantic.input(model=IacPlanCreate, all_fields=False)
class IacPlanInput:
    module_path: str = strawberry.UNSET
    environment_name: str = strawberry.UNSET
    region: str | None = None
    ref: str | None = None
    sha: str | None = None


@strawberry.type
class IacMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def create_iac_environment_config(
        self, info: Info, source_code_id: uuid.UUID, input: IacEnvironmentConfigCreateInput
    ) -> IacEnvironmentConfigType:
        await check_api_permission(info, "source_code", ["admin"])
        service = get_iac_service(session=info.context["session"])
        return await service.create_environment_config(
            source_code_id, input.to_pydantic(), requester=info.context["request"].state.user
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def update_iac_environment_config(
        self, info: Info, id: uuid.UUID, input: IacEnvironmentConfigUpdateInput
    ) -> IacEnvironmentConfigType:
        await check_api_permission(info, "source_code", ["admin"])
        service = get_iac_service(session=info.context["session"])
        return await service.update_environment_config(
            id, input.to_pydantic(), requester=info.context["request"].state.user
        )

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_iac_environment_config(self, info: Info, id: uuid.UUID) -> bool:
        await check_api_permission(info, "source_code", ["admin"])
        service = get_iac_service(session=info.context["session"])
        await service.delete_environment_config(id, requester=info.context["request"].state.user)
        return True

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def plan_iac_module(self, info: Info, source_code_id: uuid.UUID, input: IacPlanInput) -> IacRunType:
        """Queue a plan of a module in an environment."""
        await check_api_permission(info, "source_code", ["write", "admin"])
        service = get_iac_service(session=info.context["session"])
        return await service.plan(source_code_id, input.to_pydantic(), requester=info.context["request"].state.user)
