from typing import Any
from uuid import UUID

from sqlalchemy import func, literal, select, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql import union_all

from application.resources.model import Resource
from application.source_code_versions.model import SourceCodeVersion
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Template


class TemplateCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, template_id: str | UUID) -> Template | None:
        if not is_valid_uuid(template_id):
            raise ValueError(f"Invalid UUID: {template_id}")

        statement = select(Template).where(Template.id == template_id).join(User, Template.created_by == User.id)
        statement = statement.options(selectinload(Template.children), selectinload(Template.parents))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Template]:
        statement = select(Template)
        statement = evaluate_sqlalchemy_filters(Template, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Template, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(selectinload(Template.children), selectinload(Template.parents)).join(
            User, Template.created_by == User.id
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Template)
        statement = evaluate_sqlalchemy_filters(Template, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Template:
        parents = body.pop("parents", [])
        children = body.pop("children", [])

        db_template = Template(**body)
        self.session.add(db_template)
        await self.session.flush()

        if parents:
            query = select(Template).options(selectinload(Template.children)).where(Template.id.in_(parents))
            result = await self.session.execute(query)
            parents_templates = result.scalars().all()
            for parent in parents_templates:
                parent.children.append(db_template)

        if children:
            query = select(Template).options(selectinload(Template.parents)).where(Template.id.in_(children))
            result = await self.session.execute(query)
            children_templates = result.scalars().all()
            for child in children_templates:
                child.parents.append(db_template)

        return db_template

    async def update(self, existing_template: Template, body: dict[str, Any]) -> Template:
        for key, value in body.items():
            if key not in {"children", "parents"} and hasattr(existing_template, key):
                setattr(existing_template, key, value)

        # Resolve and set relationships explicitly
        if "parents" in body and body["parents"] == []:
            existing_template.parents = []
        elif "parents" in body and body["parents"]:
            parent_ids = [p.id if isinstance(p, Template) else p for p in body["parents"]]

            query = select(Template).where(Template.id.in_(parent_ids))
            result = await self.session.execute(query)
            parent_resources = result.scalars().all()
            existing_template.parents = list(parent_resources)

        if "children" in body and body["children"] == []:
            existing_template.children = []
        elif "children" in body and body["children"]:
            child_ids = [c.id if isinstance(c, Template) else c for c in body["children"]]
            query = select(Template).where(Template.id.in_(child_ids))
            result = await self.session.execute(query)
            child_resources = result.scalars().all()
            existing_template.children = list(child_resources)

        return existing_template

    async def delete(self, template: Template) -> None:
        await self.session.delete(template)

    async def get_dependencies(self, existing_template: Template) -> list[Any]:
        resource_statement = select(
            Resource.id.label("id"), Resource.name.label("name"), literal("resource").label("type")
        ).where(Resource.template_id == existing_template.id)
        source_code_version_statement = select(
            SourceCodeVersion.id.label("id"),
            SourceCodeVersion.source_code_folder.label("name"),
            literal("source_code_version").label("type"),
        ).where(SourceCodeVersion.template_id == existing_template.id)
        combined_statement = union_all(resource_statement, source_code_version_statement)
        result = await self.session.execute(combined_statement)
        return list(result.fetchall())

    async def get_tree_to_parent(self, template_id: str | UUID) -> list[dict[str, Any]]:
        recursive_query = text("""
            WITH RECURSIVE tree_view AS (
                SELECT
                    c.id,
                    NULL::uuid AS parent_id,
                    c.name,
                    c.status,
                    0 AS level,
                    ARRAY[c.id] AS path -- track visited nodes to avoid cycles
                FROM templates c
                WHERE c.id = :root_id

                UNION ALL

                SELECT
                    parent.id,
                    cl.child_id,
                    parent.name,
                    parent.status,
                    tv.level + 1 AS level,
                    path || parent.id
                FROM templates parent
                JOIN template_links cl ON cl.parent_id = parent.id
                JOIN tree_view tv ON tv.id = cl.child_id
                WHERE NOT parent.id = ANY(path) -- skip nodes already visited (avoid cycles)
            )

            SELECT
                id,
                parent_id,
                name,
                status,
                level
            FROM tree_view
            ORDER BY level, id;
        """)

        result = await self.session.execute(recursive_query, {"root_id": str(template_id)})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def get_tree_to_children(self, template_id: str | UUID) -> list[dict[str, Any]]:
        recursive_query = text("""
            WITH RECURSIVE tree_view AS (
                SELECT
                    c.id,
                    NULL::uuid AS child_id,
                    c.name,
                    c.status,
                    0 AS level,
                    ARRAY[c.id] AS path -- track visited nodes to avoid cycles
                FROM templates c
                WHERE c.id = :root_id

                UNION ALL

                SELECT
                    child.id,
                    cl.parent_id,
                    child.name,
                    child.status,
                    tv.level + 1 AS level,
                    path || child.id
                FROM templates child
                JOIN template_links cl ON cl.child_id = child.id
                JOIN tree_view tv ON tv.id = cl.parent_id
                WHERE NOT child.id = ANY(path) -- skip nodes already visited (avoid cycles)
            )

            SELECT
                id,
                child_id,
                name,
                status,
                level
            FROM tree_view
            ORDER BY level, id;
        """)

        result = await self.session.execute(recursive_query, {"root_id": str(template_id)})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def refresh(self, template: Template) -> None:
        await self.session.refresh(template)
