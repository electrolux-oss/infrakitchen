from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio.session import AsyncSession
from sqlalchemy.sql.expression import select
from sqlalchemy.sql.functions import func

from core.utils.model_tools import is_valid_uuid

from .model import ResourceTempState
from core.database import evaluate_sqlalchemy_filters


class ResourceTempStateCrud:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, resource_id: UUID | str) -> ResourceTempState | None:
        if not is_valid_uuid(resource_id):
            raise ValueError(f"Invalid UUID: {resource_id}")

        statement = select(ResourceTempState).where(ResourceTempState.id == resource_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_resource_id(self, resource_id: UUID | str) -> ResourceTempState | None:
        if not is_valid_uuid(resource_id):
            raise ValueError(f"Invalid UUID: {resource_id}")

        statement = select(ResourceTempState).where(ResourceTempState.resource_id == resource_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[ResourceTempState]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(ResourceTempState, query)
        statement = select(ResourceTempState)
        if filters:
            statement = statement.where(*filters)

        if sort:
            field, direction = sort
            if hasattr(ResourceTempState, field):
                sort_column = getattr(ResourceTempStateCrud, field)
                statement = statement.order_by(sort_column.asc() if direction.upper() == "ASC" else sort_column.desc())

        if range:
            skip, end = range
            limit = end - skip
            statement = statement.offset(skip).limit(limit)
        else:
            statement = statement.limit(100)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(ResourceTempState)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(ResourceTempState, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> ResourceTempState:
        db_temp_entity_state = ResourceTempState(**body)
        self.session.add(db_temp_entity_state)
        await self.session.flush()
        return db_temp_entity_state

    async def update(
        self, existing_resource_temp_state: ResourceTempState, updated_body: dict[str, Any]
    ) -> ResourceTempState:
        for key, value in updated_body.items():
            setattr(existing_resource_temp_state, key, value)

        return existing_resource_temp_state

    async def delete(self, resource_temp_state: ResourceTempState) -> None:
        await self.session.delete(resource_temp_state)
