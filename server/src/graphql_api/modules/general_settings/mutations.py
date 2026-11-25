import strawberry
from pydantic import ValidationError
from strawberry.types import Info

from application.general_settings.dependencies import get_general_settings_service
from application.general_settings.model import GeneralSettingsDTO
from core.users.functions import user_is_super_admin
from graphql_api.helpers import IsSuperAdmin
from graphql_api.modules.general_settings.types import GeneralSettingsInput, GeneralSettingsType


@strawberry.type
class GeneralSettingsMutation:
    @strawberry.mutation(permission_classes=[IsSuperAdmin])
    async def update_general_settings(self, info: Info, input: GeneralSettingsInput) -> GeneralSettingsType:
        requester = info.context["request"].state.user
        if not await user_is_super_admin(requester):
            raise PermissionError("Access denied")

        try:
            settings = GeneralSettingsDTO(
                name=input.name,
                banner_enabled=input.banner_enabled,
                banner_message=input.banner_message,
                banner_color=input.banner_color,
            )
        except ValidationError as error:
            raise ValueError(error.errors()[0]["msg"]) from error

        # committed with the request session, like the other mutations
        updated = await get_general_settings_service(info.context["session"]).update(settings, requester)
        return GeneralSettingsType.from_pydantic(updated)
