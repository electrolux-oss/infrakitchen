from typing import Any


from core import UserDTO
from application.resource_temp_state.crud import ResourceTempStateCrud
from application.resource_temp_state.schema import (
    ResourceTempStateResponse,
    ResourceTempStateCreate,
    ResourceTempStateUpdate,
)
from core.errors import EntityNotFound


class ResourceTempStateService:
    def __init__(self, crud: ResourceTempStateCrud):
        self.crud: ResourceTempStateCrud = crud

    async def get_by_id(self, id: str) -> ResourceTempStateResponse | None:
        entity = await self.crud.get_by_id(id)
        if entity is None:
            return None
        return ResourceTempStateResponse.model_validate(entity)

    async def get_by_resource_id(self, resource_id: str) -> ResourceTempStateResponse | None:
        entity = await self.crud.get_by_resource_id(resource_id)
        if entity is None:
            return None
        return ResourceTempStateResponse.model_validate(entity)

    async def get_all(
        self,
        **kwargs,
    ) -> list[ResourceTempStateResponse]:
        entities = await self.crud.get_all(**kwargs)
        return [ResourceTempStateResponse.model_validate(entity) for entity in entities]

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(
        self, resource_temp_state: ResourceTempStateCreate, requester: UserDTO
    ) -> ResourceTempStateResponse:
        body = resource_temp_state.model_dump(exclude_unset=True)
        created_temp_state = await self.crud.create(body)

        return ResourceTempStateResponse.model_validate(created_temp_state)

    async def update(
        self, resource_temp_state: ResourceTempStateUpdate, requester: UserDTO
    ) -> ResourceTempStateResponse | None:
        body = resource_temp_state.model_dump(exclude_unset=True)

        existing_temp_state = await self.crud.get_by_resource_id(resource_id=resource_temp_state.creator_id)
        if not existing_temp_state:
            return None
        updated_temp_state = await self.crud.update(existing_temp_state, body)

        if not updated_temp_state:
            return None

        return ResourceTempStateResponse.model_validate(updated_temp_state)

    async def delete_by_resource_id(self, resource_id: str) -> ResourceTempStateResponse | None:
        existing_resource_temp_state = await self.crud.get_by_resource_id(resource_id)
        if not existing_resource_temp_state:
            raise EntityNotFound("ResourceTempState not found")

        await self.crud.delete(existing_resource_temp_state)
