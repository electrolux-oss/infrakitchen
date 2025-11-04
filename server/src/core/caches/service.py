from datetime import datetime, timedelta, UTC
from core.caches.model import Cache, CacheDTO
from core.caches.schema import CacheCreate
from core.utils.model_tools import model_db_dump
from .crud import CacheCRUD


class CacheService:
    def __init__(
        self,
        crud: CacheCRUD,
    ):
        self.crud: CacheCRUD = crud

    async def get_cache(self, module: str, key: str) -> Cache | None:
        cache = await self.crud.get_one(filter={"module": module, "key": key})
        if cache:
            if cache.expire_at and cache.expire_at < datetime.now(UTC):
                # Cache expired
                await self.crud.delete(cache)
                await self.crud.commit()
                return None
            return cache

    async def set_cache(self, cache: CacheCreate, ttl: int | None = None) -> CacheDTO:
        if ttl:
            cache.expire_at = datetime.now() + timedelta(seconds=ttl)

        result = await self.crud.create(model_db_dump(cache))
        await self.crud.commit()
        await self.crud.refresh(result)
        return CacheDTO.model_validate(result)

    async def delete_cache(self, module: str, key: str) -> None:
        cache = await self.crud.get_one(filter={"module": module, "key": key})
        if cache:
            await self.crud.delete(cache)
            await self.crud.commit()
