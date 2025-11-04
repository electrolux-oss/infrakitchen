from collections.abc import AsyncGenerator
from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.database import SessionLocal

from .crud import UserCRUD
from .service import UserService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_user_service(
    session: AsyncSession = Depends(get_db_session),
) -> UserService:
    audit_log_handler = AuditLogHandler(session=session, entity_name="user")
    return UserService(
        crud=UserCRUD(session=session),
        audit_log_handler=audit_log_handler,
    )
