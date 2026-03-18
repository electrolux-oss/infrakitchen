from fastapi import Depends

from core.dependencies import get_db_session

from .crud import AuditLogCRUD
from .service import AuditLogService

from sqlalchemy.ext.asyncio import AsyncSession


def get_audit_log_service(
    session: AsyncSession = Depends(get_db_session),
) -> AuditLogService:
    return AuditLogService(
        crud=AuditLogCRUD(session=session),
    )
