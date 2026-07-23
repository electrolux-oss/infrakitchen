from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.permissions.dependencies import get_permission_service
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import ProjectCRUD
from .service import ProjectService

from sqlalchemy.ext.asyncio import AsyncSession


def get_project_service(
    session: AsyncSession = Depends(get_db_session),
) -> ProjectService:
    revision_handler = RevisionHandler(session=session, entity_name="project")
    event_sender = EventSender(entity_name="project")
    audit_log_handler = AuditLogHandler(session=session, entity_name="project")
    return ProjectService(
        crud=ProjectCRUD(session=session),
        permission_service=get_permission_service(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
