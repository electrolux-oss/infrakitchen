import uuid

import strawberry
from sqlalchemy import select
from strawberry.types import Info

from core.revisions.model import Revision
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.revision.types import RevisionType


@strawberry.type
class RevisionQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def revisions(self, info: Info, entity_id: uuid.UUID) -> list[RevisionType]:
        await check_api_permission(info, "revision", ["read"])
        session = info.context["session"]
        stmt = select(Revision).where(Revision.entity_id == entity_id).order_by(Revision.revision_number.desc())
        result = await session.execute(stmt)
        return result.scalars().all()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def revision(self, info: Info, entity_id: uuid.UUID, revision_number: int) -> RevisionType | None:
        await check_api_permission(info, "revision", ["read"])
        session = info.context["session"]
        stmt = select(Revision).where(
            Revision.entity_id == entity_id,
            Revision.revision_number == revision_number,
        )
        result = await session.execute(stmt)
        return result.scalars().first()
