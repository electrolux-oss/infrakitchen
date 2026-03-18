from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.logs.dependencies import get_log_service
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender

from .crud import WorkspaceCRUD
from .service import WorkspaceService

from sqlalchemy.ext.asyncio import AsyncSession


def get_workspace_service(
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceService:
    event_sender = EventSender(entity_name="workspace")
    audit_log_handler = AuditLogHandler(session=session, entity_name="workspace")
    return WorkspaceService(
        crud=WorkspaceCRUD(session=session),
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
        log_service=get_log_service(session=session),
        task_service=get_task_service(session=session),
    )
