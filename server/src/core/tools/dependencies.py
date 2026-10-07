from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.utils.event_sender import EventSender

from .crud import ToolCRUD
from .service import ToolService


def get_tool_service(
    session: AsyncSession = Depends(get_db_session),
) -> ToolService:
    return ToolService(
        crud=ToolCRUD(session=session),
        event_sender=EventSender(entity_name="tool"),
        audit_log_handler=AuditLogHandler(session=session, entity_name="tool"),
    )
