import asyncio
import logging
from contextlib import asynccontextmanager
from uuid import UUID

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from application.logger import change_logger

from core.database import SessionLocal
from core.scheduler.crud import SchedulerJobCRUD
from core.scheduler.model import JobType
from core.utils.event_sender import EventSender

change_logger()

logger = logging.getLogger("scheduler")


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session


async def run_job(job_id: UUID, job_type: JobType, job_script: str, event_sender: EventSender):
    logger.info(f"Sending scheduler job {job_id} to worker")
    await event_sender.send_scheduler_job(job_id=job_id, job_type=job_type, job_script=job_script)
    logger.info(f"Scheduler job {job_id} sent successfully to worker")


async def schedule_jobs(scheduler: AsyncIOScheduler, event_sender: EventSender):
    logger.info("Scheduling jobs from DB ...")

    async with get_async_session() as session:
        crud = SchedulerJobCRUD(session=session)
        jobs = await crud.get_all()
        if not jobs:
            logger.info("No jobs found. Skipping scheduling")
            return

        for job in jobs:
            job_id = job.id
            job_cron = job.cron
            if scheduler.get_job(str(job_id)) is None:
                cron_trigger = CronTrigger.from_crontab(job_cron)
                scheduler.add_job(
                    run_job,
                    trigger=cron_trigger,
                    args=[job_id, job.type, job.script, event_sender],
                    id=str(job_id),
                )
                logger.info(f"Scheduled job {job_id} → '{job_cron}'")


async def schedule_polling_job(scheduler: AsyncIOScheduler, event_sender: EventSender):
    """
    Schedules a polling job that periodically checks for new scheduler jobs in DB
    :param event_sender: EventSender
    :param scheduler: AsyncIOScheduler
    """
    logger.info("Scheduling polling job")

    interval_trigger = IntervalTrigger(minutes=10)
    scheduler.add_job(schedule_jobs, trigger=interval_trigger, args=[scheduler, event_sender], id="poll_new_jobs")


async def start_scheduler():
    scheduler = AsyncIOScheduler()
    event_sender = EventSender("scheduler_job")

    await schedule_jobs(scheduler=scheduler, event_sender=event_sender)
    await schedule_polling_job(scheduler=scheduler, event_sender=event_sender)

    scheduler.start()
    logger.info("Scheduler started")

    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(start_scheduler())
