from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import WorkerTemplateCRUD
from .service import WorkerTemplateService

from sqlalchemy.ext.asyncio import AsyncSession


def get_worker_template_service(
    session: AsyncSession = Depends(get_db_session),
) -> WorkerTemplateService:
    revision_handler = RevisionHandler(session=session, entity_name="worker_template")
    event_sender = EventSender(entity_name="worker_template")
    audit_log_handler = AuditLogHandler(session=session, entity_name="worker_template")
    return WorkerTemplateService(
        crud=WorkerTemplateCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
