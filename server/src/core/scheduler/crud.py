from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.scheduler.model import SchedulerJob


class SchedulerJobCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(self, job: dict[str, str | UUID | None]) -> SchedulerJob:
        scheduler_job = SchedulerJob(**job)
        self.session.add(scheduler_job)
        await self.session.flush()
        return scheduler_job

    async def get_all(self) -> list[SchedulerJob]:
        statement = select(SchedulerJob)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, job_id: UUID) -> SchedulerJob | None:
        statement = select(SchedulerJob).where(SchedulerJob.id == job_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def update(self, scheduler_job: SchedulerJob, body: dict[str, str | UUID | None]) -> SchedulerJob:
        for key, value in body.items():
            setattr(scheduler_job, key, value)

        await self.session.flush()
        return scheduler_job

    async def delete(self, scheduler_job: SchedulerJob) -> None:
        await self.session.delete(scheduler_job)
        await self.session.flush()
