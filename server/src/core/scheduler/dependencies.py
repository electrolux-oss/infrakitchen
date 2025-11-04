from collections.abc import AsyncGenerator
from fastapi import Depends

from core.database import SessionLocal

from .crud import SchedulerJobCRUD
from .service import SchedulerJobService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_scheduler_job_service(
    session: AsyncSession = Depends(get_db_session),
) -> SchedulerJobService:
    return SchedulerJobService(
        crud=SchedulerJobCRUD(session=session),
    )
