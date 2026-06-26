import strawberry
from strawberry.types import Info

from core.casbin.enforcer import CasbinEnforcer
from core.feature_flags.dependencies import get_feature_flag_service
from core.feature_flags.enforcer import FeatureFlagEnforcer
from core.feature_flags.model import FeatureFlagDTO
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsSuperAdmin
from graphql_api.modules.administration.types import FeatureFlagType, SimpleStatusType


@strawberry.input
class FeatureFlagUpdateInput:
    name: str
    config_name: str | None = None
    enabled: bool | None = None


@strawberry.type
class AdministrationMutation:
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def update_feature_flag(self, info: Info, input: FeatureFlagUpdateInput) -> FeatureFlagType:
        requester = info.context["request"].state.user
        if not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        session = info.context["session"]
        service = get_feature_flag_service(session=session)
        updated = await service.update_config(
            FeatureFlagDTO(
                name=input.name,
                config_name=input.config_name or "",
                enabled=input.enabled,
            ),
            requester,
        )
        await FeatureFlagEnforcer().send_reload_configs_event()
        return FeatureFlagType(**updated.model_dump())

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def reload_feature_flags(self, info: Info) -> SimpleStatusType:
        requester = info.context["request"].state.user
        if not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        await FeatureFlagEnforcer().send_reload_configs_event()
        return SimpleStatusType(status="ok")

    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def reload_permissions(self, info: Info) -> SimpleStatusType:
        requester = info.context["request"].state.user
        if not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        await CasbinEnforcer().send_reload_event()
        return SimpleStatusType(status="ok")
