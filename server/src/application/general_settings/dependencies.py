from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session

from .crud import GeneralSettingsCRUD
from .service import GeneralSettingsService


def get_general_settings_service(
    session: AsyncSession = Depends(get_db_session),
) -> GeneralSettingsService:
    return GeneralSettingsService(
        crud=GeneralSettingsCRUD(session=session),
        audit_log_handler=AuditLogHandler(session=session, entity_name="general_settings"),
    )
