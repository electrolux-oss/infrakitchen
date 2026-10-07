from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session
from core.utils.event_sender import EventSender

from .crud import TaskEntityCRUD
from .service import TaskEntityService


def get_task_service(
    session: AsyncSession = Depends(get_db_session),
) -> TaskEntityService:
    return TaskEntityService(
        crud=TaskEntityCRUD(session=session),
        event_sender=EventSender("scheduled_entity_action"),
    )
