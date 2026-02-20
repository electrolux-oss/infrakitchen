from collections.abc import AsyncGenerator
from fastapi import Depends

from application.favorites.dependencies import get_favorite_service
from application.integrations.dependencies import get_integration_service
from application.source_codes.dependencies import get_source_code_service
from application.storages.dependencies import get_storage_service
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.logs.dependencies import get_log_service
from core.permissions.dependencies import get_permission_service
from core.revisions.handler import RevisionHandler
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender

from .crud import ExecutorCRUD
from .service import ExecutorService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_executor_service(
    session: AsyncSession = Depends(get_db_session),
    favorite_service=Depends(get_favorite_service),
) -> ExecutorService:
    revision_handler = RevisionHandler(session=session, entity_name="executor")
    event_sender = EventSender(entity_name="executor")
    audit_log_handler = AuditLogHandler(session=session, entity_name="executor")
    return ExecutorService(
        crud=ExecutorCRUD(session=session),
        integration_service=get_integration_service(session=session),
        permission_service=get_permission_service(session=session),
        service_source_code=get_source_code_service(session=session),
        storage_service=get_storage_service(session=session),
        revision_handler=revision_handler,
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
        log_service=get_log_service(session=session),
        task_service=get_task_service(session=session),
        favorite_service=favorite_service,
    )
