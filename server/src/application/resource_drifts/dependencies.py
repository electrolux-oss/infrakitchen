from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.utils.event_sender import EventSender

from .crud import DriftSettingsCRUD, ResourceDriftCRUD
from .service import DriftSettingsService, ResourceDriftService


def get_resource_drift_service(
    session: AsyncSession = Depends(get_db_session),
    event_sender: EventSender | None = None,
) -> ResourceDriftService:
    """A resource task passes its own event sender, so the drift events go out with its commit."""
    return ResourceDriftService(
        crud=ResourceDriftCRUD(session=session),
        event_sender=event_sender or EventSender(entity_name="resource"),
    )


def get_drift_settings_service(
    session: AsyncSession = Depends(get_db_session),
) -> DriftSettingsService:
    return DriftSettingsService(
        crud=DriftSettingsCRUD(session=session),
        audit_log_handler=AuditLogHandler(session=session, entity_name="drift_settings"),
    )
