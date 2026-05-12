from collections.abc import AsyncGenerator
from fastapi import Depends

from application.workflows.dependencies import get_workflow_service
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import BlueprintCRUD
from .service import BlueprintService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_blueprint_service(
    session: AsyncSession = Depends(get_db_session),
) -> BlueprintService:
    revision_handler = RevisionHandler(session=session, entity_name="blueprint")
    event_sender = EventSender(entity_name="blueprint")
    audit_log_handler = AuditLogHandler(session=session, entity_name="blueprint")
    return BlueprintService(
        crud=BlueprintCRUD(session=session),
        workflow_service=get_workflow_service(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
