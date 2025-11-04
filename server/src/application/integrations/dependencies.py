from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import IntegrationCRUD
from .service import IntegrationService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_integration_service(
    session: AsyncSession = Depends(get_db_session),
) -> IntegrationService:
    revision_handler = RevisionHandler(session=session, entity_name="integration")
    event_sender = EventSender(entity_name="integration")
    audit_log_handler = AuditLogHandler(session=session, entity_name="integration")
    return IntegrationService(
        crud=IntegrationCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
