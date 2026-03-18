from fastapi import Depends

from core.dependencies import get_db_session

from .crud import WorkerCRUD
from .service import WorkerService

from sqlalchemy.ext.asyncio import AsyncSession


def get_worker_service(
    session: AsyncSession = Depends(get_db_session),
) -> WorkerService:
    return WorkerService(
        crud=WorkerCRUD(session=session),
    )
