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
        # settings never saved fall back to the DTO defaults; unknown stored keys are ignored
        stored = await self.crud.get_all()
        known = {key: value for key, value in stored.items() if key in GeneralSettingsDTO.model_fields}
        return GeneralSettingsDTO.model_validate(known)

    async def update(self, settings: GeneralSettingsDTO, requester: UserDTO) -> GeneralSettingsDTO:
        values = settings.model_dump()
        await self.crud.upsert(values, requester.id)
        await self.audit_log_handler.create_log(GENERAL_SETTINGS_ID, requester.id, "update", action_metadata=values)
        return settings
