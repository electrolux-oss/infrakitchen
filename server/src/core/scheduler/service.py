from .crud import SchedulerJobCRUD
from .schema import SchedulerJobResponse, SchedulerJobCreate


class SchedulerJobService:
    def __init__(
        self,
        crud: SchedulerJobCRUD,
    ):
        self.crud: SchedulerJobCRUD = crud

    async def create(self, job: SchedulerJobCreate) -> SchedulerJobResponse:
        body = job.model_dump()
        created = await self.crud.create(body)
        return SchedulerJobResponse.model_validate(created)

    async def get_all(self) -> list[SchedulerJobResponse]:
        jobs = await self.crud.get_all()
        return [SchedulerJobResponse.model_validate(job) for job in jobs]
