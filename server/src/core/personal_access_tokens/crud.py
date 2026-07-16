from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import evaluate_sqlalchemy_filters, evaluate_sqlalchemy_sorting
from core.utils.model_tools import is_valid_uuid

from .model import PersonalAccessToken


class PersonalAccessTokenCRUD:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_by_id(self, token_id: str | UUID) -> PersonalAccessToken | None:
        if not is_valid_uuid(token_id):
            raise ValueError(f"Invalid UUID: {token_id}")

        result = await self.session.execute(select(PersonalAccessToken).where(PersonalAccessToken.id == token_id))
        return result.scalar_one_or_none()

    async def get_one(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> PersonalAccessToken | None:
        statement = select(PersonalAccessToken)
        statement = evaluate_sqlalchemy_filters(PersonalAccessToken, statement, filter)
        statement = evaluate_sqlalchemy_sorting(PersonalAccessToken, statement, sort)
        result = await self.session.execute(statement)
        return result.scalars().first()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        sort: tuple[str, str] | None = None,
    ) -> list[PersonalAccessToken]:
        statement = select(PersonalAccessToken)
        statement = evaluate_sqlalchemy_filters(PersonalAccessToken, statement, filter)
        statement = evaluate_sqlalchemy_sorting(PersonalAccessToken, statement, sort)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def create(self, body: dict[str, Any]) -> PersonalAccessToken:
        db_token = PersonalAccessToken(**body)
        self.session.add(db_token)
        await self.session.flush()
        return db_token

    async def update(self, existing_token: PersonalAccessToken, body: dict[str, Any]) -> PersonalAccessToken:
        for key, value in body.items():
            if hasattr(existing_token, key):
                setattr(existing_token, key, value)
        return existing_token

    async def delete(self, token: PersonalAccessToken) -> None:
        await self.session.delete(token)
        await self.session.flush()

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(PersonalAccessToken)
        statement = evaluate_sqlalchemy_filters(PersonalAccessToken, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def refresh(self, token: PersonalAccessToken) -> None:
        await self.session.refresh(token)
