from collections.abc import AsyncGenerator
from fastapi import Depends

from core.database import SessionLocal

from .crud import AuditLogCRUD
from .service import AuditLogService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_audit_log_service(
    session: AsyncSession = Depends(get_db_session),
) -> AuditLogService:
    return AuditLogService(
        crud=AuditLogCRUD(session=session),
    )
