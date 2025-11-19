from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.logs.dependencies import get_log_service
from core.revisions.handler import RevisionHandler
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender

from .crud import SourceCodeCRUD
from .service import SourceCodeService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_source_code_service(
    session: AsyncSession = Depends(get_db_session),
) -> SourceCodeService:
    revision_handler = RevisionHandler(session=session, entity_name="source_code")
    event_sender = EventSender(entity_name="source_code")
    audit_log_handler = AuditLogHandler(session=session, entity_name="source_code")
    return SourceCodeService(
        crud=SourceCodeCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
        log_service=get_log_service(session=session),
        task_service=get_task_service(session=session),
    )
