from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session

from .crud import UserCRUD
from .service import UserService

from sqlalchemy.ext.asyncio import AsyncSession


def get_user_service(
    session: AsyncSession = Depends(get_db_session),
) -> UserService:
    audit_log_handler = AuditLogHandler(session=session, entity_name="user")
    return UserService(
        crud=UserCRUD(session=session),
        audit_log_handler=audit_log_handler,
    )
