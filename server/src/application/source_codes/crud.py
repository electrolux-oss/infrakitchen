from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.source_code_versions.model import SourceCodeVersion
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters
from core.utils.model_tools import is_valid_uuid

from .model import SourceCode


class SourceCodeCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, source_code_id: str | UUID) -> SourceCode | None:
        if not is_valid_uuid(source_code_id):
            raise ValueError(f"Invalid UUID: {source_code_id}")

        statement = (
            select(SourceCode)
            .where(SourceCode.id == source_code_id)
            .join(User, SourceCode.created_by == User.id)
            .outerjoin(Integration, SourceCode.integration_id == Integration.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> SourceCode | None:
        statement = (
            select(SourceCode)
            .join(User, SourceCode.created_by == User.id)
            .outerjoin(Integration, SourceCode.integration_id == Integration.id)
        )

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(SourceCode, query)
        if filters:
            statement = statement.where(*filters)
        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(SourceCode, field):
                sort_column = getattr(SourceCode, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[SourceCode]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(SourceCode, query)
        statement = (
            select(SourceCode)
            .join(User, SourceCode.created_by == User.id)
            .outerjoin(Integration, SourceCode.integration_id == Integration.id)
        )

        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(SourceCode, field):
                sort_column = getattr(SourceCode, field)
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
        statement = select(func.count()).select_from(SourceCode)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(SourceCode, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> SourceCode:
        db_source_code = SourceCode(**body)
        self.session.add(db_source_code)
        await self.session.flush()
        return db_source_code

    async def update(self, existing_source_code: SourceCode, body: dict[str, Any]) -> SourceCode:
        for key, value in body.items():
            setattr(existing_source_code, key, value)

        return existing_source_code

    async def delete(self, source_code: SourceCode) -> None:
        await self.session.delete(source_code)

    async def get_dependencies(self, existing_source_code: SourceCode) -> list[Any]:
        statement = select(
            SourceCodeVersion.id.label("id"),
            literal("source_code_version").label("type"),
            SourceCodeVersion.source_code_folder.label("name"),
        ).where(SourceCodeVersion.source_code_id == existing_source_code.id)
        result = await self.session.execute(statement)
        return list(result.fetchall())

    async def refresh(self, source_code: SourceCode) -> None:
        await self.session.refresh(source_code)
