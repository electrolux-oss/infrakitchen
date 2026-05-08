from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.permissions.dependencies import get_permission_service
from core.permissions.service import PermissionService
from core.revisions.handler import RevisionHandler
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender

from .crud import IntegrationCRUD
from .service import IntegrationService

from sqlalchemy.ext.asyncio import AsyncSession


def get_integration_service(
    session: AsyncSession = Depends(get_db_session),
    permission_service: PermissionService = Depends(get_permission_service),
) -> IntegrationService:
    revision_handler = RevisionHandler(session=session, entity_name="integration")
    event_sender = EventSender(entity_name="integration")
    audit_log_handler = AuditLogHandler(session=session, entity_name="integration")
    return IntegrationService(
        crud=IntegrationCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
        task_service=get_task_service(session=session),
        permission_service=permission_service,
    )
