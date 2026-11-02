import asyncio
import contextlib
import logging
import os
from prometheus_async.aio import web
import uvicorn
import base64
from alembic.command import upgrade
from alembic.config import Config

import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from application.logger import change_logger, get_uvicorn_log_config
from build_info import write_build_info
from core.config import setup_service_environment
from scheduler import setup_scheduler, stop_consumers
from worker import run_task_worker

from src.app import app
from cryptography.fernet import Fernet

logger = logging.getLogger("dev_server")


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


def dev_worker_count() -> int:
    """Number of task workers to run in-process, from DEV_WORKERS (default 1, 0 disables them)."""
    value = os.getenv("DEV_WORKERS", "1")
    try:
        count = int(value)
    except ValueError:
        logger.warning(f"Invalid DEV_WORKERS={value!r}, running 1 worker")
        return 1
    return max(count, 0)


async def start_task_workers(count: int):
    """Runs ``count`` TaskWorkers indefinitely, like separate worker nodes sharing the queue."""
    if count == 0:
        logger.info("No in-process task workers (DEV_WORKERS=0): tasks run on on-demand or external workers only")
        return
    await web.start_http_server(port=8001)
    # Workers register by name + host, so each one needs its own name to get its own worker row
    names = ["task_worker"] if count == 1 else [f"task_worker_{i}" for i in range(1, count + 1)]
    logger.info(f"Starting {count} task worker(s): {', '.join(names)}")
    # uvicorn owns the process signals in dev mode
    _ = await asyncio.gather(*(run_task_worker(handle_signals=False, name=name) for name in names))


async def run_server_and_worker():
    """
    Sets up the Uvicorn server and starts the TaskWorker as a background task.
    """
    setup_service_environment()
    change_logger()

    scheduler, consumers = await setup_scheduler()
    worker_task = asyncio.create_task(start_task_workers(dev_worker_count()))

    uvicorn_log_config = get_uvicorn_log_config()
    server_config = uvicorn.Config(
        app=app, host="0.0.0.0", port=8000, log_config=uvicorn_log_config, ws="websockets-sansio"
    )
    server = uvicorn.Server(config=server_config)

    await server.serve()
    scheduler.shutdown(wait=False)
    await stop_consumers(consumers)
    worker_task.cancel()
    with contextlib.suppress(asyncio.CancelledError):
        await worker_task


if __name__ == "__main__":
    write_build_info()
    generate_env_local()
    run_sql_migrations()
    try:
        asyncio.run(run_server_and_worker())
    except Exception:
        sys.exit(1)
