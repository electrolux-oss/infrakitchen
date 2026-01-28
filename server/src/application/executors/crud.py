from typing import Any
from uuid import UUID

from sqlalchemy import String, func, select, cast
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from application.integrations.model import Integration
from application.secrets.model import Secret
from application.source_codes.model import SourceCode
from application.storages.model import Storage
from core.permissions.model import Permission
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Executor


class ExecutorCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, executor_id: str | UUID) -> Executor | None:
        if not is_valid_uuid(executor_id):
            raise ValueError(f"Invalid UUID: {executor_id}")

        statement = (
            select(Executor)
            .where(Executor.id == executor_id)
            .join(User, Executor.created_by == User.id)
            .outerjoin(Storage, Executor.storage_id == Storage.id)
            .outerjoin(SourceCode, Executor.source_code_id == SourceCode.id)
        )
        statement = statement.options(
            selectinload(Executor.integration_ids),
            selectinload(Executor.secret_ids),
        )
        result = await self.session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Executor]:
        statement = (
            select(Executor)
            .join(User, Executor.created_by == User.id)
            .outerjoin(Storage, Executor.storage_id == Storage.id)
            .outerjoin(SourceCode, Executor.source_code_id == SourceCode.id)
        )
        statement = evaluate_sqlalchemy_sorting(Executor, statement, sort)
        statement = evaluate_sqlalchemy_filters(Executor, statement, filter)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        statement = statement.options(
            selectinload(Executor.integration_ids),
            selectinload(Executor.secret_ids),
        )

        result = await self.session.execute(statement)
        return list(result.unique().scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Executor)
        statement = evaluate_sqlalchemy_filters(Executor, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Executor:
        integration_ids = body.pop("integration_ids", [])
        secret_ids = body.pop("secret_ids", [])

        db_executor = Executor(**body)
        if integration_ids:
            integration_objs = await self.session.execute(
                select(Integration).where(Integration.id.in_(integration_ids))
            )
            db_executor.integration_ids = list(integration_objs.scalars().all())

        if secret_ids:
            secret_objs = await self.session.execute(select(Secret).where(Secret.id.in_(secret_ids)))
            db_executor.secret_ids = list(secret_objs.scalars().all())

        self.session.add(db_executor)
        await self.session.flush()

        return db_executor

    async def update(self, existing_executor: Executor, body: dict[str, Any]) -> Executor:
        for key, value in body.items():
            if key not in {"integration_ids", "secret_ids"} and hasattr(existing_executor, key):
                setattr(existing_executor, key, value)

        if body.get("integration_ids") == []:
            existing_executor.integration_ids = []
        elif body.get("integration_ids"):
            integration_ids = body.pop("integration_ids")
            integration_objects = await self.session.execute(
                select(Integration).where(Integration.id.in_(integration_ids))
            )
            integrations = integration_objects.scalars().all()
            if not len(integration_ids) == len(integrations):
                raise ValueError("Some integration ids were not found")

            existing_executor.integration_ids = list(integrations)

        if body.get("secret_ids") == []:
            existing_executor.secret_ids = []
        elif body.get("secret_ids"):
            secret_ids = body.pop("secret_ids")
            secret_objects = await self.session.execute(select(Secret).where(Secret.id.in_(secret_ids)))
            secrets = secret_objects.scalars().all()
            if not len(secret_ids) == len(secrets):
                raise ValueError("Some secret ids were not found")

            existing_executor.secret_ids = list(secrets)

        return existing_executor

    async def delete(self, executor: Executor) -> None:
        await self.session.delete(executor)

    async def refresh(self, executor: Executor) -> None:
        await self.session.refresh(executor)

    async def get_executor_policies_by_role(
        self,
        role_name: str,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Any]:
        executor_id_expr = func.split_part(Permission.v1, ":", 2)
        statement = (
            select(
                Executor.id.label("executor_id"),
                Executor.name.label("executor_name"),
                Permission.v0.label("role"),
                Permission.v2.label("action"),
                Permission.id.label("id"),
                Permission.created_at.label("created_at"),
                Permission.updated_at.label("updated_at"),
            )
            .join(
                Permission,
                cast(Executor.id, String) == executor_id_expr,
            )
            .where(
                Permission.ptype == "p",
                Permission.v1.like("executor:%"),
                Permission.v0 == role_name,
            )
        )

        statement = evaluate_sqlalchemy_sorting(Permission, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.fetchall())

    async def get_user_executor_policies(
        self,
        user_id: str | UUID,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Any]:
        executor_id_expr = func.split_part(Permission.v1, ":", 2)
        statement = (
            select(
                Executor.id.label("executor_id"),
                Executor.name.label("executor_name"),
                Permission.v2.label("action"),
                Permission.id.label("id"),
                Permission.created_at.label("created_at"),
                Permission.updated_at.label("updated_at"),
            )
            .join(
                Permission,
                cast(Executor.id, String) == executor_id_expr,
            )
            .where(
                Permission.ptype == "p",
                Permission.v1.like("executor:%"),
                Permission.v0 == f"user:{user_id}",
            )
        )

        statement = evaluate_sqlalchemy_sorting(Permission, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        result = await self.session.execute(statement)
        return list(result.fetchall())
