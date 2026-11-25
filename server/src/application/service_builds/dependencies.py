from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.services.crud import ServiceCRUD
from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.utils.event_sender import EventSender

from .crud import ServiceBuildCRUD
from .service import ServiceBuildService


def get_service_build_service(
    session: AsyncSession = Depends(get_db_session),
) -> ServiceBuildService:
    return ServiceBuildService(
        crud=ServiceBuildCRUD(session=session),
        service_crud=ServiceCRUD(session=session),
        event_sender=EventSender(entity_name="service_build"),
        audit_log_handler=AuditLogHandler(session=session, entity_name="service"),
    )
