import asyncio
from contextlib import asynccontextmanager
import logging
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "."))

from application.logger import change_logger
from core.config import setup_service_environment
from application.workers import TaskWorker
from core import RabbitMQConnection
from core.database import SessionLocal

change_logger()

logging.getLogger("aiormq").setLevel(logging.WARNING)
logging.getLogger("aio_pika").setLevel(logging.WARNING)
logger = logging.getLogger("worker")

# Initialize the lock
worker_lock = asyncio.Lock()


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session


async def run_task_worker(rabbitmq):
    async with get_async_session() as session:
        task_worker = TaskWorker(session=session, name="task_worker", lock=worker_lock)
        await task_worker.run(rabbitmq, routing_key="ik_tasks")


async def main():
    rabbitmq = RabbitMQConnection()
    await run_task_worker(rabbitmq)


if __name__ == "__main__":
    setup_service_environment()
    asyncio.run(main())
