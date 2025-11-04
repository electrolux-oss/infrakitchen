from typing import Any

from .crud import LogCRUD
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

    async def get_logs_execution_time(self, entity_id: str, trace_id: str | None = None) -> list[LogResponse]:
        """
        Execution time logs for a specific entity.
        """
        result = await self.crud.get_logs_execution_time(entity_id, trace_id)
        return list(LogResponse.model_validate(log) for log in result)
