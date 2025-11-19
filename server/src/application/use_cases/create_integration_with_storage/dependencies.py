from collections.abc import AsyncGenerator
from fastapi import Depends

from application.integrations.dependencies import get_integration_service
from application.storages.dependencies import get_storage_service
from application.use_cases.create_integration_with_storage.service import IntegrationWithStorageService
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.revisions.handler import RevisionHandler
from core.utils.event_sender import EventSender


from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_integration_with_storage_service(
    session: AsyncSession = Depends(get_db_session),
) -> IntegrationWithStorageService:
    revision_handler = RevisionHandler(session=session, entity_name="integration")
    storage_event_sender = EventSender(entity_name="storage")
    audit_log_handler = AuditLogHandler(session=session, entity_name="integration")
    integration_service = get_integration_service(session=session)
    return IntegrationWithStorageService(
        integration_service=integration_service,
        storage_service=get_storage_service(session=session),
        revision_handler=revision_handler,
        storage_event_sender=storage_event_sender,
        audit_log_handler=audit_log_handler,
    )
