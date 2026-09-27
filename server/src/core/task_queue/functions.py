from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession

from core.db_engine import engine

from .crud import TaskQueueCRUD
from .service import TaskQueueService


@asynccontextmanager
async def task_queue_service() -> AsyncIterator[TaskQueueService]:
    """Short-lived queue service on its own session, for processes without a request scope."""
    async with AsyncSession(engine, expire_on_commit=False) as session:
        yield TaskQueueService(crud=TaskQueueCRUD(session=session))
