"""Thin wrapper around ``AsyncSession`` that serialises ``execute()`` calls
through an ``asyncio.Lock``.

GraphQL (Strawberry) resolves fields concurrently via ``asyncio``.  All
resolvers within one request share the same ``AsyncSession``, which is **not**
safe for concurrent use.  Wrapping the session with a lock ensures only one
coroutine touches the underlying connection at a time, while remaining
completely transparent to the existing resolver / data-loader code (they
just call ``session.execute(…)`` as before).

REST endpoints run sequentially, so the lock is never contended there.
"""

import asyncio
from contextlib import suppress
from typing import Any

from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncSession


class LockedSession:
    """Proxy that forwards attribute access to the real ``AsyncSession`` but
    wraps ``execute()`` in an ``asyncio.Lock``."""

    __slots__ = ("_session", "_lock")

    def __init__(self, session: AsyncSession, lock: asyncio.Lock) -> None:
        self._session = session
        self._lock = lock

    async def execute(self, *args: Any, **kwargs: Any) -> Any:
        async with self._lock:
            try:
                return await self._session.execute(*args, **kwargs)
            except DBAPIError as exc:
                # Broken DBAPI connections must be invalidated so the pool
                # does not hand out the same bad connection again.
                if exc.connection_invalidated:
                    with suppress(Exception):
                        await self._session.invalidate()
                elif self._session.in_transaction():
                    with suppress(Exception):
                        await self._session.rollback()
                raise
            except Exception:
                if self._session.in_transaction():
                    with suppress(Exception):
                        await self._session.rollback()
                raise

    def __getattr__(self, name: str) -> Any:
        return getattr(self._session, name)
