import uuid

import strawberry
from sqlalchemy import select
from strawberry.types import Info

from application.resource_temp_state.model import ResourceTempState
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.resource_temp_state.types import ResourceTempStateType


@strawberry.type
class ResourceTempStateQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_temp_state(self, info: Info, id: uuid.UUID) -> ResourceTempStateType | None:
        session = info.context["session"]
        stmt = select(ResourceTempState).where(ResourceTempState.id == id)
        result = await session.execute(stmt)
        return result.scalars().first()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def resource_temp_state_by_resource(self, info: Info, resource_id: uuid.UUID) -> ResourceTempStateType | None:
        session = info.context["session"]
        stmt = select(ResourceTempState).where(ResourceTempState.resource_id == resource_id)
        result = await session.execute(stmt)
        return result.scalars().first()
