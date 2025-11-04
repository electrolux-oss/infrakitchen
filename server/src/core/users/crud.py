from typing import Any
from uuid import UUID

from sqlalchemy import asc, desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload


from core.database import evaluate_sqlalchemy_filters

from .model import User


class UserCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(self, user_id: str | UUID) -> User | None:
        statement = select(User).where(User.id == user_id)
        statement = statement.options(selectinload(User.secondary_accounts), selectinload(User.primary_account))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> User | None:
        statement = select(User)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(User, query)
        if filters:
            statement = statement.where(*filters)
        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(User, field):
                sort_column = getattr(User, field)
                statement = statement.order_by(asc(sort_column) if direction.upper() == "ASC" else desc(sort_column))

        statement = statement.options(selectinload(User.secondary_accounts), selectinload(User.primary_account))
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[User]:
        query = filter or {}
        filters = evaluate_sqlalchemy_filters(User, query)
        statement = select(User)

        statement = statement.options(selectinload(User.secondary_accounts), selectinload(User.primary_account))

        if filters:
            statement = statement.where(*filters)

        # Apply sorting
        if sort:
            field, direction = sort
            if hasattr(User, field):
                sort_column = getattr(User, field)
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
        statement = select(func.count()).select_from(User)

        query = filter or {}
        filters = evaluate_sqlalchemy_filters(User, query)
        if filters:
            statement = statement.where(*filters)

        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> User:
        db_user = User(**body)
        self.session.add(db_user)
        await self.session.flush()
        return db_user

    async def update(self, existing_user: User, body: dict[str, Any]) -> User:
        for key, value in body.items():
            if key not in {"secondary_accounts"} and hasattr(existing_user, key):
                setattr(existing_user, key, value)

        if "secondary_accounts" in body:
            secondary_body_ids = body.pop("secondary_accounts")
            user_objects = await self.session.execute(select(User).where(User.id.in_(secondary_body_ids)))
            secondary_ids = user_objects.scalars().all()
            if not len(secondary_ids) == len(secondary_body_ids):
                raise ValueError("Some user ids were not found")

            existing_user.secondary_accounts = list(secondary_ids)

        return existing_user

    async def delete(self, user: User) -> None:
        await self.session.delete(user)

    async def refresh(self, user: User) -> None:
        await self.session.refresh(user)
