from .crud import SchedulerJobCRUD
from uuid import UUID

from core.utils.event_sender import EventSender

from .schema import SchedulerJobResponse, SchedulerJobCreate, SchedulerJobUpdate


class SchedulerJobService:
    def __init__(
        self,
        crud: SchedulerJobCRUD,
        event_sender: EventSender | None = None,
    ):
        self.crud: SchedulerJobCRUD = crud
        self.event_sender: EventSender = event_sender or EventSender("scheduler_job")

    async def _notify_reload(self) -> None:
        """Notify the scheduler process that jobs changed so it can re-sync.

        The event is buffered and only published after session.commit()
        (see EventFlushingSession), so the scheduler reloads committed data.
        """
        await self.event_sender.send_reload_event("reload_scheduler_jobs")

    async def create(self, job: SchedulerJobCreate) -> SchedulerJobResponse:
        body = job.model_dump()
        created = await self.crud.create(body)
        await self._notify_reload()
        return SchedulerJobResponse.model_validate(created)

    async def get_all(self) -> list[SchedulerJobResponse]:
        jobs = await self.crud.get_all()
        return [SchedulerJobResponse.model_validate(job) for job in jobs]

    async def update(self, job_id: UUID, job: SchedulerJobUpdate) -> SchedulerJobResponse | None:
        scheduler_job = await self.crud.get_by_id(job_id)
        if scheduler_job is None:
            return None

        update_body = job.model_dump(exclude_unset=True)

        if not update_body:
            return SchedulerJobResponse.model_validate(scheduler_job)

        merged_body = {
            "type": update_body.get("type", scheduler_job.type),
            "script": update_body.get("script", scheduler_job.script),
            "cron": update_body.get("cron", scheduler_job.cron),
        }

        validated_body = SchedulerJobCreate.model_validate(merged_body)
        updated = await self.crud.update(scheduler_job, validated_body.model_dump())
        await self._notify_reload()
        return SchedulerJobResponse.model_validate(updated)

    async def delete(self, job_id: UUID) -> bool:
        scheduler_job = await self.crud.get_by_id(job_id)
        if scheduler_job is None:
            return False

        await self.crud.delete(scheduler_job)
        await self._notify_reload()
        return True
