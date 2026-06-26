import strawberry
from strawberry.types import Info

from core.feature_flags.dependencies import get_feature_flag_service
from graphql_api.helpers import IsSuperAdmin
from graphql_api.modules.administration.types import FeatureFlagType


@strawberry.type
class AdministrationQuery:
    @strawberry.field(permission_classes=[IsSuperAdmin])
    async def feature_flags(self, info: Info) -> list[FeatureFlagType]:
        session = info.context["session"]
        service = get_feature_flag_service(session=session)
        return [FeatureFlagType(**flag.model_dump()) for flag in await service.get_all()]
