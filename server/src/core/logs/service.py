from typing import Any
from uuid import UUID

from core.database import FieldSpec

from .crud import LogCRUD
from .model import Log
from .schema import LogResponse


class LogService:
    def __init__(
        self,
        crud: LogCRUD,
    ):
        self.crud: LogCRUD = crud

    async def get_by_id(self, entity_id: str) -> LogResponse | None:
        entity = await self.crud.get_by_id(entity_id)
        if entity is None:
            return None
        return LogResponse.model_validate(entity)

    async def get_all(self, **kwargs) -> list[LogResponse]:
        entities = await self.crud.get_all(**kwargs)
        return [LogResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def query_by_id(self, entity_id: str | UUID, fields: FieldSpec | None = None) -> Log | None:
        return await self.crud.get_by_id(entity_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Log]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def delete_by_entity_id(self, entity_id: str) -> None:
        await self.crud.delete_by_entity_id(entity_id)
