from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.users.model import User
from core.utils.model_tools import is_valid_uuid

from .model import Project
from .query_options import build_project_query_options


class ProjectCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        project_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> Project | None:
        if not is_valid_uuid(project_id):
            raise ValueError(f"Invalid UUID: {project_id}")

        statement = select(Project).where(Project.id == project_id)
        statement = statement.options(*build_project_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalars().unique().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Project]:
        statement = select(Project)
        statement = evaluate_sqlalchemy_filters(Project, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Project, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(*build_project_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().unique().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Project)
        statement = evaluate_sqlalchemy_filters(Project, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Project:
        owner_ids = body.pop("owners", [])
        db_project = Project(**body)

        if owner_ids:
            owner_objs = await self.session.execute(select(User).where(User.id.in_(owner_ids)))
            db_project.owners = list(owner_objs.scalars().all())
        self.session.add(db_project)
        await self.session.flush()
        return db_project

    async def update(self, existing_project: Project, body: dict[str, Any]) -> Project:
        for key, value in body.items():
            if key not in ["owners"] and hasattr(existing_project, key):
                setattr(existing_project, key, value)

        if body.get("owners") == []:
            existing_project.owners = []
        elif body.get("owners"):
            owner_ids = body.pop("owners")
            owner_objects = await self.session.execute(select(User).where(User.id.in_(owner_ids)))
            owners = owner_objects.scalars().all()
            if not len(owner_ids) == len(owners):
                raise ValueError("Some owner ids were not found")

            existing_project.owners = list(owners)

        return existing_project

    async def delete(self, project: Project) -> None:
        await self.session.delete(project)

    async def refresh(self, project: Project) -> None:
        await self.session.refresh(project)
