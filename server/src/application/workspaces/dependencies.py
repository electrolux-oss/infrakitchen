from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.utils.event_sender import EventSender

from .crud import WorkspaceCRUD
from .service import WorkspaceService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_workspace_service(
    session: AsyncSession = Depends(get_db_session),
) -> WorkspaceService:
    event_sender = EventSender(entity_name="workspace")
    audit_log_handler = AuditLogHandler(session=session, entity_name="workspace")
    return WorkspaceService(
        crud=WorkspaceCRUD(session=session),
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
