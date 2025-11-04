from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal
from core.utils.event_sender import EventSender

from .crud import AuthProviderCRUD
from .service import AuthProviderService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


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
