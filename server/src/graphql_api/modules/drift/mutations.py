import strawberry
from strawberry.types import Info

from application.resource_drifts.dependencies import get_drift_settings_service
from application.resource_drifts.model import DriftSettingsDTO
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsSuperAdmin
from graphql_api.modules.drift.types import DriftSettingsInput, DriftSettingsType


@strawberry.type
class DriftMutation:
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def update_drift_settings(self, info: Info, input: DriftSettingsInput) -> DriftSettingsType:
        requester = info.context["request"].state.user
        if not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        # committed with the request session, like the other mutations
        updated = await get_drift_settings_service(info.context["session"]).update(
            DriftSettingsDTO(enabled=input.enabled, interval_hours=input.interval_hours), requester
        )
        return DriftSettingsType.from_pydantic(updated)
