from collections.abc import AsyncGenerator
from fastapi import Depends

from application.integrations.crud import IntegrationCRUD
from application.integrations.service import IntegrationService
from application.storages.crud import StorageCRUD
from application.storages.service import StorageService
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
    event_sender = EventSender(entity_name="integration")
    storage_event_sender = EventSender(entity_name="storage")
    audit_log_handler = AuditLogHandler(session=session, entity_name="integration")
    integration_service = IntegrationService(
        crud=IntegrationCRUD(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )

    return IntegrationWithStorageService(
        integration_service=integration_service,
        storage_service=StorageService(
            crud=StorageCRUD(session=session),
            revision_handler=revision_handler,
            event_sender=storage_event_sender,
            audit_log_handler=audit_log_handler,
            integration_service=integration_service,
        ),
        revision_handler=revision_handler,
        storage_event_sender=storage_event_sender,
        audit_log_handler=audit_log_handler,
    )
