import asyncio
import os
import uvicorn
import base64
from alembic.command import upgrade
from alembic.config import Config

import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from application.logger import change_logger, get_uvicorn_log_config
from core.config import setup_service_environment
from core.rabbitmq import RabbitMQConnection
from core.utils.event_sender import EventSender
from scheduler import schedule_jobs, schedule_polling_job
from worker import run_task_worker

from src.app import app
from cryptography.fernet import Fernet


def generate_env_local():
    """
    Generates a .env.local file with the necessary environment variables.
    """

    root_dir = os.path.dirname(os.path.realpath(__file__))
    if os.path.exists(f"{root_dir}/.env_local"):
        return

    key = Fernet.generate_key().decode()
    encryption_key = base64.urlsafe_b64encode(key.encode()).decode()

    jwt_secret = base64.urlsafe_b64encode(os.urandom(32)).decode()

    env_content = f'ENCRYPTION_KEY = "{encryption_key}"\nJWT_KEY = "{jwt_secret}"\n'
    with open(f"{root_dir}/.env_local", "w") as env_file:
        env_file.write(env_content)


def run_sql_migrations():
    # retrieves the directory that *this* file is in
    root_dir = os.path.dirname(os.path.realpath(__file__))
    # this assumes the alembic.ini is also contained in this same directory
    config_file = os.path.join(root_dir, "src/alembic.ini")

    config = Config(file_=config_file)
    config.set_main_option("script_location", f"{root_dir}/src/alembic")

    # upgrade the database to the latest revision
    upgrade(config, "head")


async def start_task_worker():
    """Initializes and runs the TaskWorker indefinitely."""
    rabbitmq = RabbitMQConnection()
    await run_task_worker(rabbitmq)


async def setup_scheduler():
    """Initializes and configures the AsyncIOScheduler."""
    scheduler = AsyncIOScheduler()

    event_sender = EventSender("scheduler_job")

    await schedule_jobs(scheduler=scheduler, event_sender=event_sender)
    await schedule_polling_job(scheduler=scheduler, event_sender=event_sender)

    scheduler.start()

    return scheduler


async def run_server_and_worker():
    """
    Sets up the Uvicorn server and starts the TaskWorker as a background task.
    """
    setup_service_environment()
    change_logger()

    scheduler = await setup_scheduler()
    worker_task = asyncio.create_task(start_task_worker())

    uvicorn_log_config = get_uvicorn_log_config()
    server_config = uvicorn.Config(
        app=app, host="0.0.0.0", port=8000, log_config=uvicorn_log_config, ws="websockets-sansio"
    )
    server = uvicorn.Server(config=server_config)

    await server.serve()
    scheduler.shutdown(wait=False)
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass


if __name__ == "__main__":
    generate_env_local()
    run_sql_migrations()
    try:
        asyncio.run(run_server_and_worker())
    except Exception:
        sys.exit(1)
