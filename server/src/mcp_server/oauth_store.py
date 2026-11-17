"""Postgres-backed key/value storage for MCP OAuth state, built on the generic `caches` table."""

from datetime import UTC, datetime, timedelta

from pydantic import BaseModel
from sqlalchemy import delete as sa_delete

from core.caches.crud import CacheCRUD
from core.caches.model import Cache
from core.dependencies import get_async_session

MODULE = "mcp_oauth"


async def put[T: BaseModel](kind: str, key: str, value: T, ttl: timedelta | None) -> None:
    expire_at = datetime.now(UTC) + (ttl if ttl is not None else timedelta(days=3650))
    async with get_async_session() as session:
        crud = CacheCRUD(session)
        existing = await crud.get_one(filter={"module": MODULE, "key": f"{kind}:{key}"})
        if existing is not None:
            await crud.delete(existing)
        await crud.create(
            {
                "module": MODULE,
                "key": f"{kind}:{key}",
                "value": value.model_dump_json().encode(),
                "expire_at": expire_at,
            }
        )
        await crud.commit()


async def get[T: BaseModel](kind: str, key: str, model: type[T]) -> T | None:
    async with get_async_session() as session:
        crud = CacheCRUD(session)
        entry = await crud.get_one(filter={"module": MODULE, "key": f"{kind}:{key}"})
        if entry is None:
            return None
        if entry.expire_at <= datetime.now(UTC):
            await crud.delete(entry)
            await crud.commit()
            return None
        return model.model_validate_json(entry.value)


async def pop[T: BaseModel](kind: str, key: str, model: type[T]) -> T | None:
    """Atomically fetch and delete a single-use value (authorization codes, refresh tokens)."""
    async with get_async_session() as session:
        result = await session.execute(
            sa_delete(Cache)
            .where(Cache.module == MODULE, Cache.key == f"{kind}:{key}")
            .returning(Cache.value, Cache.expire_at)
        )
        rows = result.all()
        await session.commit()
    if not rows:
        return None
    value, expire_at = rows[0]
    if expire_at <= datetime.now(UTC):
        return None
    return model.model_validate_json(value)


async def delete(kind: str, key: str) -> None:
    async with get_async_session() as session:
        crud = CacheCRUD(session)
        entry = await crud.get_one(filter={"module": MODULE, "key": f"{kind}:{key}"})
        if entry is not None:
            await crud.delete(entry)
            await crud.commit()
