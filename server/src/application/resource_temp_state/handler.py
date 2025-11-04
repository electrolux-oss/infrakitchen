from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio.session import AsyncSession
from sqlalchemy.sql.expression import select

from application.resource_temp_state.model import ResourceTempState


class ResourceTempStateHandler:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def create(
        self, resource_id: UUID | str, updated_value: dict[str, Any], created_by: UUID | str
    ) -> ResourceTempState:
        resource_temp_state = ResourceTempState(resource_id=resource_id, value=updated_value, created_by=created_by)

        self.session.add(resource_temp_state)
        await self.session.flush()
        return resource_temp_state

    async def set_resource_temp_state(self, resource_id: UUID, value: dict[str, Any], created_by: UUID) -> None:
        temp_entity_state = await self.get_by_resource_id(resource_id)
        if temp_entity_state:
            await self.update_resource_temp_state(temp_entity_state, value)
        else:
            await self.create(resource_id, value, created_by)

    async def update_resource_temp_state(self, updated_resource_temp_state, updated_value) -> None:
        new_value_dict = updated_resource_temp_state.value.copy()
        new_value_dict.update(updated_value)
        updated_resource_temp_state.value = new_value_dict

    async def get_by_resource_id(self, resource_id: UUID) -> ResourceTempState | None:
        statement = select(ResourceTempState).where(ResourceTempState.resource_id == str(resource_id))
        result = await self.session.execute(statement)
        temp_entity_state = result.scalar_one_or_none()
        return temp_entity_state

    async def delete_by_resource_id(self, resource_id: UUID) -> None:
        temp_entity_state = await self.get_by_resource_id(resource_id)
        if temp_entity_state:
            await self.session.delete(temp_entity_state)
            await self.session.flush()
        else:
            raise ValueError(f"No temporary entity state found for resource ID {resource_id} and model")
