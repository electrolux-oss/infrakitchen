from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session

from .crud import TaskQueueCRUD
from .service import TaskQueueService


def get_task_queue_service(
    session: AsyncSession = Depends(get_db_session),
) -> TaskQueueService:
    return TaskQueueService(crud=TaskQueueCRUD(session=session))
