from fastapi import Depends

from core.dependencies import get_db_session

from .crud import SchedulerJobCRUD
from .service import SchedulerJobService

from sqlalchemy.ext.asyncio import AsyncSession


def get_scheduler_job_service(
    session: AsyncSession = Depends(get_db_session),
) -> SchedulerJobService:
    return SchedulerJobService(
        crud=SchedulerJobCRUD(session=session),
    )
