from fastapi import Depends

from core.dependencies import get_db_session

from .crud import LogCRUD
from .service import LogService

from sqlalchemy.ext.asyncio import AsyncSession


def get_log_service(
    session: AsyncSession = Depends(get_db_session),
) -> LogService:
    return LogService(
        crud=LogCRUD(session=session),
    )
