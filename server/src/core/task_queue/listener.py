import asyncio
import logging
from collections.abc import Callable
from typing import Any

from core.db_engine import engine

from .model import TASK_QUEUE_CHANNEL

logger = logging.getLogger(__name__)

PING_SECONDS = 30
RETRY_SECONDS = 30


async def listen_task_queue(on_notify: Callable[[], None], name: str) -> None:
    """Call ``on_notify`` on every NOTIFY of the task queue channel, forever.

    The connection is pinged, so a dead one is noticed and the listener re-created; meanwhile
    callers fall back to their periodic polling.
    """

    def callback(*_: Any) -> None:
        on_notify()

    while True:
        try:
            async with engine.connect() as conn:
                raw = await conn.get_raw_connection()
                driver = raw.driver_connection
                if driver is None:
                    raise RuntimeError("No driver connection available for LISTEN")
                await driver.add_listener(TASK_QUEUE_CHANNEL, callback)
                try:
                    while True:
                        await asyncio.sleep(PING_SECONDS)
                        # Raises when the connection died, so the listener is re-created
                        _ = await driver.fetchval("SELECT 1")
                finally:
                    await driver.remove_listener(TASK_QUEUE_CHANNEL, callback)
        except asyncio.CancelledError:
            raise
        except Exception as e:
            logger.warning(f"{name} listener stopped: {e}, falling back to polling for {RETRY_SECONDS}s")
            await asyncio.sleep(RETRY_SECONDS)
