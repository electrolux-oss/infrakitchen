from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import SessionLocal
from core.utils.event_sender import flush_all_pending_senders


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    """Yield a DB session that auto-commits, then flushes pending events.
    This guarantees RabbitMQ consumers always see committed data.
    """
    async with SessionLocal() as session:
        async with session.begin():
            yield session
        await flush_all_pending_senders()


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session
