"""Which pool of workers runs a task.

A task's ``worker_template_id`` names the pool whose workers may claim it; None is the pool of static
workers (started without ``WORKER_TEMPLATE_ID``). Core only stores and compares it: the rules that pick
the pool belong to worker templates, which register a resolver at import (like the provider adapters).
Until one is registered every task runs on static workers.
"""

from collections.abc import Awaitable, Callable
from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

# Returns the pool of each item, in order: called in the enqueue transaction, once per batch
PoolResolver = Callable[[AsyncSession, list[dict[str, Any]]], Awaitable[list[UUID | None]]]


async def _static_pools(session: AsyncSession, items: list[dict[str, Any]]) -> list[UUID | None]:
    return [None] * len(items)


_resolver: PoolResolver = _static_pools


def register_pool_resolver(resolver: PoolResolver) -> None:
    global _resolver
    _resolver = resolver


async def resolve_targets(session: AsyncSession, items: list[dict[str, Any]]) -> None:
    """Set ``worker_template_id`` on queue items about to be inserted."""
    if not items:
        return
    for item, pool in zip(items, await _resolver(session, items), strict=True):
        item["worker_template_id"] = pool
