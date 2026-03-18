from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.utils.event_sender import EventSender

from .crud import AuthProviderCRUD
from .service import AuthProviderService

from sqlalchemy.ext.asyncio import AsyncSession


def get_auth_provider_service(
    session: AsyncSession = Depends(get_db_session),
) -> AuthProviderService:
    event_sender = EventSender(entity_name="auth_provider")
    audit_log_handler = AuditLogHandler(session=session, entity_name="auth_provider")
    return AuthProviderService(
        crud=AuthProviderCRUD(session=session),
        event_sender=event_sender,
        audit_log_handler=audit_log_handler,
    )
