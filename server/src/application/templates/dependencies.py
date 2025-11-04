from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import TemplateCRUD
from .service import TemplateService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_template_service(
    session: AsyncSession = Depends(get_db_session),
) -> TemplateService:
    revision_handler = RevisionHandler(session=session, entity_name="template")
    event_sender = EventSender(entity_name="template")
    audit_log_handler = AuditLogHandler(session=session, entity_name="template")
    return TemplateService(
        crud=TemplateCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
