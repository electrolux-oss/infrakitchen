import asyncio
import logging
import os
import signal
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), "."))

from application.logger import change_logger
from core.config import Settings, setup_service_environment
from core.telemetry import init_metrics
from application.workers import TaskWorker

change_logger()

logger = logging.getLogger("worker")


async def run_task_worker(handle_signals: bool = True, name: str = "task_worker"):
    task_worker = TaskWorker(name=name)
    if handle_signals:
        # Drain on SIGTERM/SIGINT: finish the current task, then exit (used for scale-down)
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(sig, task_worker.stop)
    await task_worker.run()


async def main():
    init_metrics(service_name=f"{Settings().OTEL_SERVICE_NAME}-worker")
    await run_task_worker()


if __name__ == "__main__":
    setup_service_environment()
    asyncio.run(main())
