from typing import Any
from uuid import UUID

from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.integrations.model import Integration
from application.resources.model import Resource
from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import Secret


class SecretCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, secret_id: str | UUID) -> Secret | None:
        if not is_valid_uuid(secret_id):
            raise ValueError(f"Invalid UUID: {secret_id}")

        statement = (select(Secret).where(Secret.id == secret_id).join(User, Secret.created_by == User.id)).outerjoin(
            Integration, Secret.integration_id == Integration.id
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[Secret]:
        statement = (
            select(Secret)
            .join(User, Secret.created_by == User.id)
            .outerjoin(Integration, Secret.integration_id == Integration.id)
        )
        statement = evaluate_sqlalchemy_filters(Secret, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Secret, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Secret)
        statement = evaluate_sqlalchemy_filters(Secret, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Secret:
        db_secret = Secret(**body)
        self.session.add(db_secret)
        await self.session.flush()
        return db_secret

    async def update(self, existing_secret: Secret, body: dict[str, Any]) -> Secret:
        for key, value in body.items():
            setattr(existing_secret, key, value)

        return existing_secret

    async def delete(self, secret: Secret) -> None:
        await self.session.delete(secret)

    async def get_dependencies(self, existing_secret: Secret) -> list[Any]:
        resource_statement = select(
            Resource.id.label("id"), Resource.name.label("name"), literal("resource").label("type")
        ).where(Resource.secret_ids.any(Secret.id == existing_secret.id))

        result = await self.session.execute(resource_statement)
        return list(result.fetchall())

    async def refresh(self, secret: Secret) -> None:
        await self.session.refresh(secret)
