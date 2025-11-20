import re
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
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

    async def get_casbin_user_policy_model(
        self,
        user_id: str | UUID,
        object: UUID | str,
        action: str = "read",
        object_type: str | None = None,
    ) -> Permission | None:
        subject_id = f"user:{user_id}"

        if is_valid_uuid(object):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = f"resource:{object}"
        elif isinstance(object, str):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = object
        else:
            raise ValueError("Casbin object must be a string or UUID")

        statement = select(Permission).where(
            Permission.ptype == "p",
            Permission.v0 == subject_id,
            Permission.v1 == object_id,
            Permission.v2 == action,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_casbin_policy_model(
        self,
        subject: str,
        object: UUID | str,
        action: str = "read",
        object_type: str | None = None,
    ) -> Permission | None:
        subject_id = f"{subject}"

        if is_valid_uuid(object):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = f"resource:{object}"
        elif isinstance(object, str):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = object
        else:
            raise ValueError("Casbin object must be a string or UUID")

        statement = select(Permission).where(
            Permission.ptype == "p",
            Permission.v0 == subject_id,
            Permission.v1 == object_id,
            Permission.v2 == action,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_casbin_user_role_model(
        self,
        user_id: str | UUID,
        object: str | UUID,
        object_type: str | None = None,
    ) -> Permission | None:
        subject_id = f"user:{user_id}"

        if is_valid_uuid(object):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = f"resource:{object}"
        elif isinstance(object, str):
            if not re.match(r"^[a-z_*]+$", object):
                raise ValueError("Object must be a string of lowercase letters and (_, *)")

            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = object
        else:
            raise ValueError("Casbin object must be a string or UUID")

        statement = select(Permission).where(
            Permission.ptype == "g",
            Permission.v0 == subject_id,
            Permission.v1 == object_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_casbin_role_model(
        self,
        subject: str,
        object: str | UUID,
        subject_type: str = "role",
        object_type: str | None = None,
    ) -> Permission | None:
        if not re.match(r"^[a-z_]+$", subject):
            raise ValueError("Subject must be a string of lowercase letters and _")
        subject_id = f"{subject_type}:{subject}"

        if is_valid_uuid(object):
            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = f"resource:{object}"

        elif isinstance(object, str):
            if not re.match(r"^[a-z_*]+$", object):
                raise ValueError("Object must be a string of lowercase letters and (_, *)")

            if object_type:
                object_id = f"{object_type}:{object}"
            else:
                object_id = object
        else:
            raise ValueError("Casbin object must be a string or UUID")

        statement = select(Permission).where(
            Permission.ptype == "g",
            Permission.v0 == subject_id,
            Permission.v1 == object_id,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def update(self, existing_permission: Permission, body: dict[str, Any]) -> Permission:
        for key, value in body.items():
            setattr(existing_permission, key, value)

        return existing_permission

    async def delete_resource_permissions(self, resource_id: str | UUID) -> None:
        if not is_valid_uuid(resource_id):
            raise ValueError(f"Invalid UUID: {resource_id}")

        statement = (
            select(Permission)
            .where(
                Permission.v1 == f"resource:{resource_id}",
            )
            .outerjoin(User, Permission.created_by == User.id)
        )
        result = await self.session.execute(statement)
        permissions = result.scalars().all()

        for permission in permissions:
            await self.session.delete(permission)
