from typing import Any
from uuid import UUID

from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.resources.model import Resource
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Workspace


class WorkspaceCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, workspace_id: str | UUID) -> Workspace | None:
        if not is_valid_uuid(workspace_id):
            raise ValueError(f"Invalid UUID: {workspace_id}")

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
        statement = (
            select(Workspace)
            .join(User, Workspace.created_by == User.id)
            .join(Integration, Workspace.integration_id == Integration.id)
        )
        statement = evaluate_sqlalchemy_filters(Workspace, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Workspace, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Workspace)
        statement = evaluate_sqlalchemy_filters(Workspace, statement, filter)
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
        resource_statement = select(
            Resource.id.label("id"), Resource.name.label("name"), literal("resource").label("type")
        ).where(Resource.workspace_id == existing_workspace.id)
        result = await self.session.execute(resource_statement)
        return list(result.fetchall())

    async def refresh(self, workspace: Workspace) -> None:
        await self.session.refresh(workspace)
