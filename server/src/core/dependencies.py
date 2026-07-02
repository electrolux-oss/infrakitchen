import asyncio
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager, suppress
from starlette.requests import HTTPConnection
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import SessionLocal
from core.utils.event_sender import flush_all_pending_senders


def _get_graphql_session_lock(connection: HTTPConnection) -> asyncio.Lock | None:
    if not hasattr(connection, "state"):
        return None
    session_lock = getattr(connection.state, "graphql_session_lock", None)
    if isinstance(session_lock, asyncio.Lock):
        return session_lock
    return None


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
            session_lock = _get_graphql_session_lock(connection)
            if session_lock is not None:
                async with session_lock:
                    if graphql_failed and session.in_transaction():
                        await session.rollback()
                    elif session.in_transaction():
                        await session.commit()
            else:
                if graphql_failed and session.in_transaction():
                    await session.rollback()
                elif session.in_transaction():
                    await session.commit()
        except DBAPIError as exc:
            session_lock = _get_graphql_session_lock(connection)
            if session_lock is not None:
                async with session_lock:
                    if exc.connection_invalidated:
                        with suppress(Exception):
                            await session.invalidate()
                    elif session.in_transaction():
                        with suppress(Exception):
                            await session.rollback()
            else:
                if exc.connection_invalidated:
                    with suppress(Exception):
                        await session.invalidate()
                elif session.in_transaction():
                    with suppress(Exception):
                        await session.rollback()
            raise
        except Exception:
            session_lock = _get_graphql_session_lock(connection)
            if session_lock is not None:
                async with session_lock:
                    if session.in_transaction():
                        with suppress(Exception):
                            await session.rollback()
            else:
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
