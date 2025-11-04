from typing import Any

from .crud import AuditLogCRUD
from .schema import AuditLogResponse


class AuditLogService:
    def __init__(
        self,
        crud: AuditLogCRUD,
    ):
        self.crud: AuditLogCRUD = crud

    async def get_by_id(self, entity_id: str) -> AuditLogResponse | None:
        entity = await self.crud.get_by_id(entity_id)
        if entity is None:
            return None
        return AuditLogResponse.model_validate(entity)

    async def get_all(self, **kwargs) -> list[AuditLogResponse]:
        entities = await self.crud.get_all(**kwargs)
        return [AuditLogResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def get_actions(self) -> list[str]:
        return await self.crud.get_actions()
