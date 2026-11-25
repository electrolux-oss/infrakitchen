from core.audit_logs.handler import AuditLogHandler
from core.users.model import UserDTO

from .crud import GeneralSettingsCRUD
from .model import GENERAL_SETTINGS_ID, GeneralSettingsDTO


class GeneralSettingsService:
    """Global general settings, changed by an admin at any time."""

    def __init__(self, crud: GeneralSettingsCRUD, audit_log_handler: AuditLogHandler):
        self.crud: GeneralSettingsCRUD = crud
        self.audit_log_handler: AuditLogHandler = audit_log_handler

    async def get(self) -> GeneralSettingsDTO:
        row = await self.crud.get()
        return GeneralSettingsDTO.model_validate(row) if row else GeneralSettingsDTO()

    async def update(self, settings: GeneralSettingsDTO, requester: UserDTO) -> GeneralSettingsDTO:
        row = await self.crud.get_or_create()
        values = {
            "name": settings.name,
            "banner_enabled": settings.banner_enabled,
            "banner_message": settings.banner_message,
            "banner_color": settings.banner_color,
        }
        row = await self.crud.update(row, {**values, "updated_by": requester.id})
        await self.audit_log_handler.create_log(GENERAL_SETTINGS_ID, requester.id, "update", action_metadata=values)
        return GeneralSettingsDTO.model_validate(row)
