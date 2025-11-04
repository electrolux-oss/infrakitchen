from typing import Any

from .crud import TaskEntityCRUD
from .schema import TaskEntityResponse


class TaskEntityService:
    def __init__(
        self,
        crud: TaskEntityCRUD,
    ):
        self.crud: TaskEntityCRUD = crud

    async def get_by_id(self, entity_id: str) -> TaskEntityResponse | None:
        entity = await self.crud.get_by_id(entity_id)
        if entity is None:
            return None
        return TaskEntityResponse.model_validate(entity)

    async def get_all(self, **kwargs) -> list[TaskEntityResponse]:
        entities = await self.crud.get_all(**kwargs)
        return [TaskEntityResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)
