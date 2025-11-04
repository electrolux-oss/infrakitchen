from collections.abc import AsyncGenerator
from fastapi import Depends

from application.integrations.dependencies import get_integration_service
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender

from .crud import StorageCRUD
from .service import StorageService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_storage_service(
    session: AsyncSession = Depends(get_db_session),
) -> StorageService:
    revision_handler = RevisionHandler(session=session, entity_name="storage")
    event_sender = EventSender(entity_name="storage")
    audit_log_handler = AuditLogHandler(session=session, entity_name="storage")
    integration_service = get_integration_service(session=session)
    return StorageService(
        crud=StorageCRUD(session=session),
        integration_service=integration_service,
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
