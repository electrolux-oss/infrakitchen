import asyncio
import json
import logging
from typing import Any
from uuid import UUID

import aio_pika
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from application.logger import change_logger

from core.dependencies import get_async_session
from core.rabbitmq import RabbitMQConnection
from core.scheduler.crud import SchedulerJobCRUD
from core.scheduler.model import JobType
from core.utils.event_sender import EventSender

change_logger()

logger = logging.getLogger("scheduler")

# Id of the internal polling job. Excluded when reconciling DB jobs so it is
# never treated as a stale job and removed.
POLL_JOB_ID = "poll_new_jobs"

# Serializes reconciliation so the event-driven reload and the periodic poll
# never mutate the APScheduler job store concurrently.
_reconcile_lock = asyncio.Lock()


async def run_job(job_id: UUID, job_type: JobType, job_script: str, event_sender: EventSender):
    logger.info(f"Sending scheduler job {job_id} to worker")
    await event_sender.send_scheduler_job(job_id=job_id, job_type=job_type, job_script=job_script)
    await event_sender.flush()
    logger.info(f"Scheduler job {job_id} sent successfully to worker")


def _add_or_replace_job(scheduler: AsyncIOScheduler, job, event_sender: EventSender) -> None:
    """(Re)register an APScheduler cron job from a DB SchedulerJob row.

    The job's defining fields (cron/type/script) are stored in the APScheduler
    job ``kwargs`` so a later reconcile can detect changes. ``replace_existing``
    makes this idempotent and applies cron/script updates in place.
    """
    cron_trigger = CronTrigger.from_crontab(job.cron)
    scheduler.add_job(
        run_job,
        trigger=cron_trigger,
        kwargs={
            "job_id": job.id,
            "job_type": job.type,
            "job_script": job.script,
            "event_sender": event_sender,
        },
        id=str(job.id),
        name=job.cron,
        replace_existing=True,
    )


def _job_changed(existing, job) -> bool:
    """Return True if the DB row differs from the currently scheduled job."""
    kwargs: dict[str, Any] = existing.kwargs or {}
    return existing.name != job.cron or kwargs.get("job_type") != job.type or kwargs.get("job_script") != job.script


async def schedule_jobs(scheduler: AsyncIOScheduler, event_sender: EventSender):
    """Reconcile the APScheduler job store with the DB.

    Adds new jobs, updates jobs whose cron/script/type changed, and removes
    jobs that no longer exist in the DB. Safe to call repeatedly (poll) or on
    demand (reload event).
    """
    logger.info("Reconciling scheduler jobs from DB ...")

    async with _reconcile_lock:
        async with get_async_session() as session:
            crud = SchedulerJobCRUD(session=session)
            jobs = await crud.get_all()

        db_job_ids = {str(job.id) for job in jobs}

        # Add or update jobs that are present in the DB.
        for job in jobs:
            existing = scheduler.get_job(str(job.id))
            if existing is None:
                _add_or_replace_job(scheduler, job, event_sender)
                logger.info(f"Scheduled job {job.id} → '{job.cron}'")
            elif _job_changed(existing, job):
                _add_or_replace_job(scheduler, job, event_sender)
                logger.info(f"Rescheduled job {job.id} → '{job.cron}'")

        # Remove jobs that were deleted from the DB (ignore internal jobs).
        for existing in scheduler.get_jobs():
            if existing.id == POLL_JOB_ID:
                continue
            if existing.id not in db_job_ids:
                scheduler.remove_job(existing.id)
                logger.info(f"Removed stale job {existing.id}")

    if not jobs:
        logger.info("No jobs found in DB")


async def schedule_polling_job(scheduler: AsyncIOScheduler, event_sender: EventSender):
    """
    Schedules a polling job that periodically checks for new scheduler jobs in DB
    :param event_sender: EventSender
    :param scheduler: AsyncIOScheduler
    """
    logger.info("Scheduling polling job")

    interval_trigger = IntervalTrigger(minutes=10)
    scheduler.add_job(
        schedule_jobs,
        trigger=interval_trigger,
        kwargs={"scheduler": scheduler, "event_sender": event_sender},
        id=POLL_JOB_ID,
        replace_existing=True,
    )


async def reload_consumer(scheduler: AsyncIOScheduler, event_sender: EventSender):
    """Subscribe to the FANOUT event exchange and re-sync jobs on demand.

    Mirrors core.utils.event_stream_manager.rabbitmq_consumer but binds its own
    dedicated queue so the scheduler receives its own copy of every broadcast
    event (FANOUT delivers to each bound queue).
    """

    async def callback(message: aio_pika.abc.AbstractIncomingMessage) -> None:
        async with message.process(ignore_processed=True):
            try:
                decoded: dict[str, Any] = json.loads(message.body.decode())
            except (ValueError, UnicodeDecodeError):
                logger.warning("Received malformed event message, ignoring")
                return

            if decoded.get("_metadata", {}).get("event") == "reload_scheduler_jobs":
                logger.info("Got reload_scheduler_jobs event, re-syncing jobs")
                await schedule_jobs(scheduler=scheduler, event_sender=event_sender)

    async with RabbitMQConnection() as connection:
        channel = await connection.get_channel()
        if channel is None:
            raise RuntimeError("Failed to create a channel. Connection might not be established.")

        events_exchange = await channel.declare_exchange(
            "ik_event_messages",
            aio_pika.ExchangeType.FANOUT,
            auto_delete=False,
            durable=True,
        )

        queue = await channel.declare_queue(name="scheduler_reload_consumer", auto_delete=False)
        _ = await queue.bind(events_exchange)

        consumer_tag = await queue.consume(callback)
        logger.info("Subscribed RabbitMQ ik_event_messages for scheduler reloads")

        try:
            await asyncio.Future()
        except asyncio.CancelledError:
            if consumer_tag:
                await queue.cancel(consumer_tag)
            raise


async def start_reload_consumer(scheduler: AsyncIOScheduler, event_sender: EventSender):
    """Run the reload consumer, restarting it if it stops unexpectedly."""
    try:
        await reload_consumer(scheduler=scheduler, event_sender=event_sender)
    except asyncio.CancelledError:
        raise
    except Exception as e:
        logger.error(f"Scheduler reload consumer stopped unexpectedly: {e}, restarting in 5 seconds")
        await asyncio.sleep(5)
        await start_reload_consumer(scheduler=scheduler, event_sender=event_sender)


async def start_scheduler():
    scheduler = AsyncIOScheduler()
    event_sender = EventSender("scheduler_job")

    await schedule_jobs(scheduler=scheduler, event_sender=event_sender)
    await schedule_polling_job(scheduler=scheduler, event_sender=event_sender)

    scheduler.start()
    logger.info("Scheduler started")

    reload_task = asyncio.create_task(start_reload_consumer(scheduler=scheduler, event_sender=event_sender))

    try:
        await asyncio.Event().wait()
    finally:
        reload_task.cancel()
        try:
            await reload_task
        except (asyncio.CancelledError, Exception):
            pass


if __name__ == "__main__":
    asyncio.run(start_scheduler())
