from fastapi import Depends

from core.dependencies import get_db_session

from .crud import TaskEntityCRUD
from .service import TaskEntityService

from sqlalchemy.ext.asyncio import AsyncSession


def get_task_service(
    session: AsyncSession = Depends(get_db_session),
) -> TaskEntityService:
    return TaskEntityService(
        crud=TaskEntityCRUD(session=session),
    )
