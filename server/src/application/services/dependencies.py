from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.notifications.dependencies import get_subscription_service
from core.permissions.dependencies import get_permission_service
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import ServiceCRUD
from .service import ServiceService

from sqlalchemy.ext.asyncio import AsyncSession


def get_service_service(
    session: AsyncSession = Depends(get_db_session),
) -> ServiceService:
    revision_handler = RevisionHandler(session=session, entity_name="service")
    event_sender = EventSender(entity_name="service")
    audit_log_handler = AuditLogHandler(session=session, entity_name="service")
    return ServiceService(
        crud=ServiceCRUD(session=session),
        permission_service=get_permission_service(session=session),
        subscription_service=get_subscription_service(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
