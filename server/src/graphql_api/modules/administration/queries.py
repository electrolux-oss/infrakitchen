import strawberry
from strawberry.types import Info

from core.feature_flags.dependencies import get_feature_flag_service
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.administration.types import FeatureFlagType


@strawberry.type
class AdministrationQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def feature_flags(self, info: Info) -> list[FeatureFlagType]:
        requester = info.context["request"].state.user
        if not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        session = info.context["session"]
        service = get_feature_flag_service(session=session)
        return [FeatureFlagType(**flag.model_dump()) for flag in await service.get_all()]
