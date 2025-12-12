from typing import Any
from uuid import UUID

from sqlalchemy import func, select, cast, String
from sqlalchemy.ext.asyncio import AsyncSession

from core.users.model import User

from core.utils.model_tools import is_valid_uuid
from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting

from .model import Permission


class PermissionCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, permission_id: str | UUID) -> Permission | None:
        if not is_valid_uuid(permission_id):
            raise ValueError(f"Invalid UUID: {permission_id}")

        statement = (
            select(Permission).where(Permission.id == permission_id).outerjoin(User, Permission.created_by == User.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Permission]:
        statement = select(Permission).outerjoin(User, Permission.created_by == User.id)
        statement = evaluate_sqlalchemy_filters(Permission, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Permission, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Permission)
        statement = evaluate_sqlalchemy_filters(Permission, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def count_roles(self, filter: dict[str, Any] | None = None) -> int:
        if not filter:
            filter = {"ptype": "g"}
        else:
            filter["ptype"] = "g"

        statement = select(func.count(func.distinct(Permission.v1))).select_from(Permission)
        statement = evaluate_sqlalchemy_filters(Permission, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Permission:
        permission = Permission(**body)
        self.session.add(permission)
        await self.session.flush()
        return permission

    async def delete_entity_permissions(self, entity_name: str, entity_id: str | UUID) -> None:
        if not is_valid_uuid(entity_id):
            raise ValueError(f"Invalid UUID: {entity_id}")

        statement = (
            select(Permission)
            .where(
                Permission.v1 == f"{entity_name}:{entity_id}",
            )
            .outerjoin(User, Permission.created_by == User.id)
        )
        result = await self.session.execute(statement)
        permissions = result.scalars().all()

        for permission in permissions:
            await self.session.delete(permission)

    async def delete(self, permission: Permission) -> None:
        await self.session.delete(permission)

    async def get_all_roles(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
    ) -> list[Permission]:
        if not filter:
            filter = {"ptype": "g"}
        else:
            filter["ptype"] = "g"

        statement = select(Permission).outerjoin(User, Permission.created_by == User.id).distinct(Permission.v1)
        statement = evaluate_sqlalchemy_filters(Permission, statement, filter)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_users_by_role(
        self,
        role_name: str,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Any]:
        user_id_expr = func.split_part(Permission.v0, ":", 2)

        statement = (
            select(
                User.id.label("user_id"),
                User.identifier.label("identifier"),
                User.email.label("email"),
                User.provider.label("provider"),
                User.display_name.label("display_name"),
                Permission.v1.label("role"),
                Permission.id.label("id"),
                Permission.created_at.label("created_at"),
                Permission.updated_at.label("updated_at"),
            )
            .join(Permission, cast(User.id, String) == user_id_expr)
            .where(
                Permission.ptype == "g",
                Permission.v1 == role_name,
                Permission.v0.like("user:%"),
            )
        )

        statement = evaluate_sqlalchemy_sorting(User, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.fetchall())

    async def get_api_policies_by_role(
        self,
        role_name: str,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Permission]:
        statement = (
            select(Permission)
            .where(
                Permission.ptype == "p",
                Permission.v1.like("api:%"),
                Permission.v0 == role_name,
            )
            .outerjoin(User, Permission.created_by == User.id)
        )

        statement = evaluate_sqlalchemy_sorting(Permission, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.scalars().all())
