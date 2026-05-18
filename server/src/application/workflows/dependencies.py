from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import WorkflowCRUD
from .service import WorkflowService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_workflow_service(
    session: AsyncSession = Depends(get_db_session),
) -> WorkflowService:
    revision_handler = RevisionHandler(session=session, entity_name="workflow")
    event_sender = EventSender(entity_name="workflow")
    audit_log_handler = AuditLogHandler(session=session, entity_name="workflow")
    return WorkflowService(
        crud=WorkflowCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
