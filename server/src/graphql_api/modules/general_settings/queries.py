import strawberry
from strawberry.types import Info

from application.general_settings.dependencies import get_general_settings_service
from graphql_api.helpers import IsSuperAdmin
from graphql_api.modules.general_settings.types import GeneralSettingsType


@strawberry.type
class GeneralSettingsQuery:
    @strawberry.field(permission_classes=[IsSuperAdmin])
    async def general_settings(self, info: Info) -> GeneralSettingsType:
        settings = await get_general_settings_service(info.context["session"]).get()
        return GeneralSettingsType.from_pydantic(settings)
