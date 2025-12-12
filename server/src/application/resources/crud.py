from typing import Any
from uuid import UUID

from sqlalchemy import String, case, func, select, text, cast
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from application.integrations.model import Integration
from application.secrets.model import Secret
from application.source_code_versions.model import SourceCodeVersion
from application.storages.model import Storage
from core.permissions.model import Permission
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Resource


class ResourceCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, resource_id: str | UUID) -> Resource | None:
        if not is_valid_uuid(resource_id):
            raise ValueError(f"Invalid UUID: {resource_id}")

        statement = (
            select(Resource)
            .where(Resource.id == resource_id)
            .join(User, Resource.created_by == User.id)
            .outerjoin(Storage, Resource.storage_id == Storage.id)
            .outerjoin(SourceCodeVersion, Resource.source_code_version_id == SourceCodeVersion.id)
        )
        statement = statement.options(
            selectinload(Resource.integration_ids),
            selectinload(Resource.children),
            selectinload(Resource.parents),
            selectinload(Resource.secret_ids),
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Resource]:
        statement = (
            select(Resource)
            .join(User, Resource.created_by == User.id)
            .outerjoin(Storage, Resource.storage_id == Storage.id)
            .outerjoin(SourceCodeVersion, Resource.source_code_version_id == SourceCodeVersion.id)
        )
        statement = evaluate_sqlalchemy_sorting(Resource, statement, sort)
        statement = evaluate_sqlalchemy_filters(Resource, statement, filter)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(
            selectinload(Resource.integration_ids),
            selectinload(Resource.children),
            selectinload(Resource.parents),
            selectinload(Resource.secret_ids),
        )

        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Resource)
        statement = evaluate_sqlalchemy_filters(Resource, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Resource:
        parents = body.pop("parents", [])
        children = body.pop("children", [])
        integration_ids = body.pop("integration_ids", [])
        secret_ids = body.pop("secret_ids", [])

        db_resource = Resource(**body)
        if integration_ids:
            integration_objs = await self.session.execute(
                select(Integration).where(Integration.id.in_(integration_ids))
            )
            db_resource.integration_ids = list(integration_objs.scalars().all())

        if secret_ids:
            secret_objs = await self.session.execute(select(Secret).where(Secret.id.in_(secret_ids)))
            db_resource.secret_ids = list(secret_objs.scalars().all())

        self.session.add(db_resource)
        await self.session.flush()

        if parents:
            query = select(Resource).options(selectinload(Resource.children)).where(Resource.id.in_(parents))
            result = await self.session.execute(query)
            parents_resources = result.scalars().all()
            for parent in parents_resources:
                parent.children.append(db_resource)

        if children:
            query = select(Resource).options(selectinload(Resource.parents)).where(Resource.id.in_(children))
            result = await self.session.execute(query)
            children_resources = result.scalars().all()
            for child in children_resources:
                child.parents.append(db_resource)

        return db_resource

    async def update(self, existing_resource: Resource, body: dict[str, Any]) -> Resource:
        for key, value in body.items():
            if key not in {"integration_ids", "parents", "children", "secret_ids"} and hasattr(existing_resource, key):
                setattr(existing_resource, key, value)

        if body.get("integration_ids") == []:
            existing_resource.integration_ids = []
        elif body.get("integration_ids"):
            integration_ids = body.pop("integration_ids")
            integration_objects = await self.session.execute(
                select(Integration).where(Integration.id.in_(integration_ids))
            )
            integrations = integration_objects.scalars().all()
            if not len(integration_ids) == len(integrations):
                raise ValueError("Some integration ids were not found")

            existing_resource.integration_ids = list(integrations)

        if body.get("secret_ids") == []:
            existing_resource.secret_ids = []
        elif body.get("secret_ids"):
            secret_ids = body.pop("secret_ids")
            secret_objects = await self.session.execute(select(Secret).where(Secret.id.in_(secret_ids)))
            secrets = secret_objects.scalars().all()
            if not len(secret_ids) == len(secrets):
                raise ValueError("Some secret ids were not found")

            existing_resource.secret_ids = list(secrets)

        if body.get("parents") == []:
            existing_resource.parents = []
        elif body.get("parents"):
            parent_ids = body.pop("parents")
            query = select(Resource).options(selectinload(Resource.parents)).where(Resource.id.in_(parent_ids))
            result = await self.session.execute(query)
            parents_resources = result.scalars().all()
            existing_resource.parents = list(parents_resources)

        if body.get("children") == []:
            existing_resource.children = []
        elif body.get("children"):
            child_ids = body.pop("children")
            query = select(Resource).options(selectinload(Resource.children)).where(Resource.id.in_(child_ids))
            result = await self.session.execute(query)
            children_resources = result.scalars().all()
            existing_resource.children = list(children_resources)

        return existing_resource

    async def delete(self, resource: Resource) -> None:
        await self.session.delete(resource)

    async def get_tree_to_parent(self, resource_id: str | UUID) -> list[dict[str, Any]]:
        recursive_query = text("""
            WITH RECURSIVE tree_view AS (
                SELECT
                    c.id,
                    NULL::uuid AS parent_id,
                    c.name,
                    c.status,
                    c.state,
                    temp.name AS template_name,
                    0 AS level,
                    ARRAY[c.id] AS path -- track visited nodes to avoid cycles
                FROM resources c
                LEFT JOIN templates temp ON c.template_id = temp.id
                WHERE c.id = :root_id

                UNION ALL

                SELECT
                    child.id,
                    cl.parent_id,
                    child.name,
                    child.status,
                    child.state,
                    temp.name AS template_name,
                    tv.level + 1 AS level,
                    path || child.id
                FROM resources child
                JOIN resource_links cl ON cl.child_id = child.id
                JOIN tree_view tv ON tv.id = cl.parent_id
                LEFT JOIN templates temp ON child.template_id = temp.id
                WHERE NOT child.id = ANY(path) -- skip nodes already visited (avoid cycles)
            )

            SELECT
                id,
                parent_id,
                name,
                status,
                state,
                template_name,
                level
            FROM tree_view
            ORDER BY level, id;
        """)

        result = await self.session.execute(recursive_query, {"root_id": str(resource_id)})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def get_tree_to_children(self, resource_id: str | UUID) -> list[dict[str, Any]]:
        recursive_query = text("""
            WITH RECURSIVE tree_view AS (
                SELECT
                    c.id,
                    NULL::uuid AS child_id,
                    c.name,
                    c.status,
                    c.state,
                    temp.name AS template_name,
                    0 AS level,
                    ARRAY[c.id] AS path -- track visited nodes to avoid cycles
                FROM resources c
                LEFT JOIN templates temp ON c.template_id = temp.id
                WHERE c.id = :root_id

                UNION ALL

                SELECT
                    parent.id,
                    cl.child_id,
                    parent.name,
                    parent.status,
                    parent.state,
                    temp.name AS template_name,
                    tv.level + 1 AS level,
                    path || parent.id
                FROM resources parent
                JOIN resource_links cl ON cl.parent_id = parent.id
                JOIN tree_view tv ON tv.id = cl.child_id
                LEFT JOIN templates temp ON parent.template_id = temp.id
                WHERE NOT parent.id = ANY(path) -- skip nodes already visited (avoid cycles)
            )

            SELECT
                id,
                child_id,
                name,
                status,
                state,
                template_name,
                level
            FROM tree_view
            ORDER BY level, id;
        """)

        result = await self.session.execute(recursive_query, {"root_id": str(resource_id)})
        rows = result.mappings().all()
        return [dict(row) for row in rows]

    async def get_parent_ids(self, resource_id: str | UUID) -> list[UUID]:
        """Get all parent ids of a resource by id. Direction is from parent to child (root)."""
        recursive_query = text("""
            WITH RECURSIVE tree_view AS (
                SELECT
                    c.id,
                    NULL::uuid AS parent_id,
                    0 AS level,
                    ARRAY[c.id] AS path -- track visited nodes to avoid cycles
                FROM resources c
                WHERE c.id = :root_id

                UNION ALL

                SELECT
                    child.id,
                    cl.parent_id,
                    tv.level + 1 AS level,
                    path || child.id
                FROM resources child
                JOIN resource_links cl ON cl.child_id = child.id
                JOIN tree_view tv ON tv.id = cl.parent_id
                WHERE NOT child.id = ANY(path) -- skip nodes already visited (avoid cycles)
            )

            SELECT
                id
            FROM tree_view
            ORDER BY level, id;
        """)

        result = await self.session.execute(recursive_query, {"root_id": str(resource_id)})
        rows = result.mappings().all()
        return [row["id"] for row in reversed(rows)]

    async def get_parents_with_configs(self, resource_ids: list[UUID]) -> list[Resource]:
        """Get all parent resources with configs by resource ids. Direction is from child to parent (leaf)."""
        statement = (
            select(Resource)
            .where(Resource.id.in_(resource_ids))
            .outerjoin(SourceCodeVersion, Resource.source_code_version_id == SourceCodeVersion.id)
            .options(selectinload(Resource.integration_ids))
        )
        order_case = case({id_: index for index, id_ in enumerate(resource_ids)}, value=Resource.id)
        statement = statement.order_by(order_case)
        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def refresh(self, resource: Resource) -> None:
        await self.session.refresh(resource)

    async def get_resource_policies_by_role(
        self,
        role_name: str,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Any]:
        resource_id_expr = func.split_part(Permission.v1, ":", 2)
        statement = (
            select(
                Resource.id.label("resource_id"),
                Resource.name.label("resource_name"),
                Permission.v0.label("role"),
                Permission.v2.label("action"),
                Permission.id.label("id"),
                Permission.created_at.label("created_at"),
                Permission.updated_at.label("updated_at"),
            )
            .join(
                Permission,
                cast(Resource.id, String) == resource_id_expr,
            )
            .where(
                Permission.ptype == "p",
                Permission.v1.like("resource:%"),
                Permission.v0 == role_name,
            )
        )

        statement = evaluate_sqlalchemy_sorting(Permission, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.fetchall())

    async def get_user_resource_policies(
        self,
        user_id: str | UUID,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Any]:
        resource_id_expr = func.split_part(Permission.v1, ":", 2)
        statement = (
            select(
                Resource.id.label("resource_id"),
                Resource.name.label("resource_name"),
                Permission.v2.label("action"),
                Permission.id.label("id"),
                Permission.created_at.label("created_at"),
                Permission.updated_at.label("updated_at"),
            )
            .join(
                Permission,
                cast(Resource.id, String) == resource_id_expr,
            )
            .where(
                Permission.ptype == "p",
                Permission.v1.like("resource:%"),
                Permission.v0 == f"user:{user_id}",
            )
        )

        statement = evaluate_sqlalchemy_sorting(Permission, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.fetchall())
