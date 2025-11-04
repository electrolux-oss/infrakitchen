from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.resources.model import Resource
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters

from .model import Workspace


class WorkspaceCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, workspace_id: str | UUID) -> Workspace | None:
        statement = (
            select(Workspace).where(Workspace.id == workspace_id).join(User, Workspace.created_by == User.id)
        ).join(Integration, Workspace.integration_id == Integration.id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Workspace]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Workspace, query)
        statement = (
            select(Workspace)
            .join(User, Workspace.created_by == User.id)
            .join(Integration, Workspace.integration_id == Integration.id)
        )

        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(Workspace, field):
                sort_column = getattr(Workspace, field)
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
        statement = select(func.count()).select_from(Workspace)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(Workspace, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Workspace:
        db_workspace = Workspace(**body)
        self.session.add(db_workspace)
        await self.session.flush()
        return db_workspace

    async def update(self, existing_workspace: Workspace, body: dict[str, Any]) -> Workspace:
        for key, value in body.items():
            setattr(existing_workspace, key, value)

        return existing_workspace

    async def delete(self, workspace: Workspace) -> None:
        await self.session.delete(workspace)

    async def get_dependencies(self, existing_workspace: Workspace) -> list[Any]:
        resource_statement = select(Resource.id.label("id"), literal("resource").label("type")).where(
            Resource.workspace_id == existing_workspace.id
        )
        result = await self.session.execute(resource_statement)
        return list(result.fetchall())

    async def refresh(self, workspace: Workspace) -> None:
        await self.session.refresh(workspace)
