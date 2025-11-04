from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.users.model import User

from core.database import evaluate_sqlalchemy_filters

from .model import AuthProvider


class AuthProviderCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, auth_provider_id: str | UUID) -> AuthProvider | None:
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
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(AuthProvider, query)
        statement = select(AuthProvider).outerjoin(User, AuthProvider.created_by == User.id)

        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(AuthProvider, field):
                sort_column = getattr(AuthProvider, field)
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
        statement = select(func.count()).select_from(AuthProvider)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(AuthProvider, query)
        if filters:
            statement = statement.where(*filters)

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
