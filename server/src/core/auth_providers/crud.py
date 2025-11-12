from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.users.model import User

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_pagination, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import AuthProvider


class AuthProviderCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, auth_provider_id: str | UUID) -> AuthProvider | None:
        if not is_valid_uuid(auth_provider_id):
            raise ValueError(f"Invalid UUID: {auth_provider_id}")

        statement = (
            select(AuthProvider)
            .where(AuthProvider.id == auth_provider_id)
            .outerjoin(User, AuthProvider.created_by == User.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[AuthProvider]:
        statement = select(AuthProvider).outerjoin(User, AuthProvider.created_by == User.id)
        statement = evaluate_sqlalchemy_filters(AuthProvider, statement, filter)
        statement = evaluate_sqlalchemy_sorting(AuthProvider, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(AuthProvider)
        statement = evaluate_sqlalchemy_filters(AuthProvider, statement, filter)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> AuthProvider:
        db_auth_provider = AuthProvider(**body)
        self.session.add(db_auth_provider)
        await self.session.flush()
        return db_auth_provider

    async def update(self, existing_auth_provider: AuthProvider, body: dict[str, Any]) -> AuthProvider:
        for key, value in body.items():
            setattr(existing_auth_provider, key, value)

        return existing_auth_provider

    async def delete(self, auth_provider: AuthProvider) -> None:
        await self.session.delete(auth_provider)

    async def refresh(self, auth_provider: AuthProvider) -> None:
        await self.session.refresh(auth_provider)
