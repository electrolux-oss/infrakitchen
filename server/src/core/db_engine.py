import json
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import create_async_engine

from core.config import setup_service_environment
from core.utils.json_encoder import JsonEncoder

setup_service_environment()

from core.config import Settings  # noqa: E402

logger = logging.getLogger(__name__)

# Kept apart from core.database so that modules imported by core.database
# (e.g. EventSender) can use the engine without an import cycle.
engine = create_async_engine(
    str(Settings().db_url),
    pool_size=20,
    max_overflow=40,
    json_serializer=lambda obj: json.dumps(obj, cls=JsonEncoder),
)


@asynccontextmanager
async def try_advisory_lock(key: int) -> AsyncIterator[bool]:
    """Session-level advisory lock on a dedicated connection, yields whether it was acquired.

    Held for the whole block without keeping a transaction open, so slow work (e.g. calling
    external APIs) can run under it.
    """
    async with engine.connect() as conn:
        locked = bool((await conn.execute(select(func.pg_try_advisory_lock(key)))).scalar_one())
        await conn.commit()
        try:
            yield locked
        finally:
            if locked:
                try:
                    _ = await conn.execute(select(func.pg_advisory_unlock(key)))
                    await conn.commit()
                except Exception as e:
                    # The lock goes away with the connection anyway
                    logger.warning(f"Cannot release advisory lock {key}: {e}")
