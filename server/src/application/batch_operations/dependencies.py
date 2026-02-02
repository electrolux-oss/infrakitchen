from collections.abc import AsyncGenerator
from fastapi import Depends

from application.executors.dependencies import get_executor_service
from application.resources.dependencies import get_resource_service
from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.tasks.dependencies import get_task_service
from core.utils.event_sender import EventSender

from .crud import BatchOperationCRUD
from .service import BatchOperationService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_batch_operation_service(
    session: AsyncSession = Depends(get_db_session),
) -> BatchOperationService:
    event_sender = EventSender(entity_name="batch_operation")
    audit_log_handler = AuditLogHandler(session=session, entity_name="batch_operation")

    return BatchOperationService(
        crud=BatchOperationCRUD(session=session),
        executor_service=get_executor_service(session=session),
        resource_service=get_resource_service(session=session),
        task_service=get_task_service(session=session),
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
