from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from starlette.requests import HTTPConnection
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import SessionLocal
from core.utils.event_sender import flush_all_pending_senders


async def get_db_session(connection: HTTPConnection) -> AsyncGenerator[AsyncSession]:
    """Yield a DB session that auto-commits, then flushes pending events.
    This guarantees RabbitMQ consumers always see committed data.
    """
    async with SessionLocal() as session:
        try:
            yield session
            graphql_failed = (
                getattr(connection.state, "graphql_failed", False) if hasattr(connection, "state") else False
            )
            if graphql_failed and session.in_transaction():
                await session.rollback()
            elif session.in_transaction():
                await session.commit()
        except DBAPIError as exc:
            if exc.connection_invalidated:
                with suppress(Exception):
                    await session.invalidate()
            elif session.in_transaction():
                with suppress(Exception):
                    await session.rollback()
            raise
        except Exception:
            if session.in_transaction():
                with suppress(Exception):
                    await session.rollback()
            raise
        finally:
            await flush_all_pending_senders()


@asynccontextmanager
async def get_async_session():
    async with SessionLocal() as session:
        yield session
