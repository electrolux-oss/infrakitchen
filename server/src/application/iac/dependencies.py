from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.source_codes.crud import SourceCodeCRUD
from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.utils.event_sender import EventSender

from .crud import IacCRUD
from .service import IacService


def get_iac_service(session: AsyncSession = Depends(get_db_session)) -> IacService:
    return IacService(
        crud=IacCRUD(session=session),
        source_code_crud=SourceCodeCRUD(session=session),
        event_sender=EventSender(entity_name="iac_run"),
        # Changes and runs are recorded on the repository they belong to.
        audit_log_handler=AuditLogHandler(session=session, entity_name="source_code"),
    )
