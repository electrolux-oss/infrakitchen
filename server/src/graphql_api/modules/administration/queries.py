import strawberry
from strawberry.types import Info

from core.feature_flags.dependencies import get_feature_flag_service
from graphql_api.helpers import IsSuperAdmin
from application.resource_drifts.service import get_drift_settings
from graphql_api.modules.administration.types import DriftSettingsType, FeatureFlagType


@strawberry.type
class AdministrationQuery:
    @strawberry.field(permission_classes=[IsSuperAdmin])
    async def feature_flags(self, info: Info) -> list[FeatureFlagType]:
        session = info.context["session"]
        service = get_feature_flag_service(session=session)
        return [FeatureFlagType(**flag.model_dump()) for flag in await service.get_all()]

    @strawberry.field(permission_classes=[IsSuperAdmin])
    async def drift_settings(self, info: Info) -> DriftSettingsType:
        settings = await get_drift_settings(info.context["session"])
        return DriftSettingsType(**settings.model_dump())
