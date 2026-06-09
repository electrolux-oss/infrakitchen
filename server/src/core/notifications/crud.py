from typing import Any
from uuid import UUID

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import (
    FieldSpec,
    evaluate_sqlalchemy_filters,
    evaluate_sqlalchemy_pagination,
    evaluate_sqlalchemy_sorting,
)
from core.utils.model_tools import is_valid_uuid

from .model import Subscription, NotificationPreference
from .query_options import build_subscription_query_options, build_notification_preference_query_options


class SubscriptionCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        subscription_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> Subscription | None:
        if not is_valid_uuid(subscription_id):
            raise ValueError(f"Invalid UUID: {subscription_id}")

        statement = select(Subscription).where(Subscription.id == subscription_id)
        statement = statement.options(*build_subscription_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Subscription]:
        statement = select(Subscription)
        statement = evaluate_sqlalchemy_filters(Subscription, statement, filter)
        statement = evaluate_sqlalchemy_sorting(Subscription, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.options(*build_subscription_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(Subscription)
        statement = evaluate_sqlalchemy_filters(Subscription, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> Subscription:
        db_subscription = Subscription(**body)
        self.session.add(db_subscription)
        await self.session.flush()
        return db_subscription

    async def delete(self, subscription: Subscription) -> None:
        await self.session.delete(subscription)

    async def delete_many_by_entity_id(self, entity_type: str, entity_id: str) -> None:
        statement = delete(Subscription).where(
            Subscription.entity_type == entity_type, Subscription.entity_id == entity_id
        )
        await self.session.execute(statement)


class NotificationPreferenceCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_by_id(
        self,
        preference_id: str | UUID,
        fields: FieldSpec | None = None,
    ) -> NotificationPreference | None:
        if not is_valid_uuid(preference_id):
            raise ValueError(f"Invalid UUID: {preference_id}")

        statement = select(NotificationPreference).where(NotificationPreference.id == preference_id)
        statement = statement.options(*build_notification_preference_query_options(fields))
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[NotificationPreference]:
        statement = select(NotificationPreference)
        statement = evaluate_sqlalchemy_filters(NotificationPreference, statement, filter)
        statement = evaluate_sqlalchemy_sorting(NotificationPreference, statement, sort)
        statement = evaluate_sqlalchemy_pagination(statement, range)
        statement = statement.options(*build_notification_preference_query_options(fields))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        statement = select(func.count()).select_from(NotificationPreference)
        statement = evaluate_sqlalchemy_filters(NotificationPreference, statement, filter)
        result = await self.session.execute(statement)
        return result.scalar_one() or 0

    async def create(self, body: dict[str, Any]) -> NotificationPreference:
        db_preference = NotificationPreference(**body)
        self.session.add(db_preference)
        await self.session.flush()
        return db_preference

    async def delete(self, preference: NotificationPreference) -> None:
        await self.session.delete(preference)
