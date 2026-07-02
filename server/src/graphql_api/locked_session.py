"""Thin wrapper around ``AsyncSession`` that serialises async DB calls through
an ``asyncio.Lock``.

GraphQL (Strawberry) resolves fields concurrently via ``asyncio``. All
resolvers within one request share the same ``AsyncSession``, which is **not**
safe for concurrent use. Wrapping the session with a lock ensures only one
coroutine touches the underlying connection at a time, while remaining
transparent to the existing resolver / service / data-loader code.

REST endpoints run sequentially, so the lock is never contended there.
"""

import asyncio
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession


class LockedSession:
    """Proxy that forwards attribute access to the real ``AsyncSession`` but
    wraps async DB methods in an ``asyncio.Lock``."""

    __slots__ = ("_session", "_lock")

    def __init__(self, session: AsyncSession, lock: asyncio.Lock) -> None:
        self._session = session
        self._lock = lock

    async def _run_locked(self, method_name: str, *args: Any, **kwargs: Any) -> Any:
        async with self._lock:
            method = getattr(self._session, method_name)
            return await method(*args, **kwargs)

    async def execute(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("execute", *args, **kwargs)

    async def get(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("get", *args, **kwargs)

    async def flush(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("flush", *args, **kwargs)

    async def refresh(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("refresh", *args, **kwargs)

    async def delete(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("delete", *args, **kwargs)

    async def commit(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("commit", *args, **kwargs)

    async def rollback(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("rollback", *args, **kwargs)

    async def invalidate(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("invalidate", *args, **kwargs)

    async def close(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("close", *args, **kwargs)

    async def scalar(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("scalar", *args, **kwargs)

    async def scalars(self, *args: Any, **kwargs: Any) -> Any:
        return await self._run_locked("scalars", *args, **kwargs)

    def __getattr__(self, name: str) -> Any:
        return getattr(self._session, name)
