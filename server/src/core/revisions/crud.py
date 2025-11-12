from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession


from core.database import evaluate_sqlalchemy_filters
from core.utils.model_tools import is_valid_uuid

from .model import Revision


class RevisionCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, revision_id: str | UUID) -> Revision | None:
        if not is_valid_uuid(revision_id):
            raise ValueError(f"Invalid UUID: {revision_id}")

        statement = select(Revision).where(Revision.id == revision_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_revision_by_entity_and_number(self, entity_id: str | UUID, revision_number: int) -> Revision | None:
        statement = (
            select(Revision)
            .where(
                Revision.entity_id == entity_id,
                Revision.revision_number == revision_number,
            )
            .order_by(Revision.created_at.desc())
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_entity_all_revisions(
        self,
        entity_id: str | UUID,
    ) -> list[Revision]:
        statement = (
            select(Revision)
            .where(
                Revision.entity_id == entity_id,
            )
            .order_by(Revision.revision_number.desc())
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Revision]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Revision, query)
        statement = select(Revision)

        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(Revision, field):
                sort_column = getattr(Revision, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        # Apply pagination
        if range:
            skip, end = range
            limit = end - skip
            statement = statement.offset(skip).limit(limit)
        else:
            statement = statement.limit(100)  # default limit

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Revision)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Revision, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Revision:
        db_revision = Revision(**body)
        self.session.add(db_revision)
        await self.session.flush()
        return db_revision

    async def update(self, existing_revision: Revision, body: dict[str, Any]) -> Revision:
        for key, value in body.items():
            setattr(existing_revision, key, value)

        return existing_revision

    async def delete(self, revision: Revision) -> None:
        await self.session.delete(revision)

    async def refresh(self, revision: Revision) -> None:
        await self.session.refresh(revision)
