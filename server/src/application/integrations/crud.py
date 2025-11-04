from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import union_all

from application.resources.model import Resource
from application.source_codes.model import SourceCode
from application.storages.model import Storage
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters
from core.utils.model_tools import is_valid_uuid

from .model import Integration


class IntegrationCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, integration_id: str | UUID) -> Integration | None:
        assert is_valid_uuid(integration_id), "Integration ID must be a valid UUID"
        statement = (
            select(Integration).where(Integration.id == integration_id).join(User, Integration.created_by == User.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Integration]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Integration, query)
        statement = select(Integration).join(User, Integration.created_by == User.id)

        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(Integration, field):
                sort_column = getattr(Integration, field)
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
        statement = select(func.count()).select_from(Integration)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Integration, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Integration:
        db_integration = Integration(**body)
        self.session.add(db_integration)
        await self.session.flush()
        return db_integration

    async def update(self, existing_integration: Integration, body: dict[str, Any]) -> Integration:
        for key, value in body.items():
            setattr(existing_integration, key, value)

        return existing_integration

    async def delete(self, integration: Integration) -> None:
        await self.session.delete(integration)

    async def get_dependencies(self, existing_integration: Integration) -> list[Any]:
        resource_statement = select(
            Resource.id.label("id"), Resource.name.label("name"), literal("resource").label("type")
        ).where(Resource.integration_ids.any(Integration.id == existing_integration.id))
        source_code_statement = select(
            SourceCode.id.label("id"),
            SourceCode.source_code_url.label("name"),
            literal("source_code").label("type"),
        ).where(SourceCode.integration_id == existing_integration.id)
        storage_statement = select(
            Storage.id.label("id"),
            Storage.name.label("name"),
            literal("storage").label("type"),
        ).where(Storage.integration_id == existing_integration.id)

        combined_statement = union_all(resource_statement, source_code_statement, storage_statement)
        result = await self.session.execute(combined_statement)
        return list(result.fetchall())

    async def refresh(self, integration: Integration) -> None:
        await self.session.refresh(integration)
