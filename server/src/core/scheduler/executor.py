import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.errors import CannotProceed
from core.scheduler.model import JobType

logger = logging.getLogger(__name__)


class SchedulerExecutor:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def execute(self, job_type: JobType, script: str):
        match job_type:
            case JobType.SQL:
                await self.execute_sql(script)
            case _:
                raise CannotProceed(f"Scheduler job type {job_type} is not supported")

    async def execute_sql(self, script: str):
        logger.info(f"Executing SQL script: {script}")
        try:
            # Only single SQL statement is supported
            await self.session.execute(text(script))

        except Exception as e:
            logger.error(f"Failed to execute SQL script {script}. Error: {e}")
