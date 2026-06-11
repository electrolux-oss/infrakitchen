import logging
from typing import Any
from uuid import UUID

from core.database import FieldSpec
from core.errors import AccessDenied, EntityNotFound
from core.users.functions import user_is_super_admin
from core.users.model import UserDTO

from .crud import SubscriptionCRUD, NotificationPreferenceCRUD
from .model import (
    Subscription,
    NotificationPreference,
    SubscriptionDTO,
    NotificationPreferenceDTO,
)

logger = logging.getLogger(__name__)


class SubscriptionService:
    def __init__(self, crud: SubscriptionCRUD):
        self.crud: SubscriptionCRUD = crud

    async def get_by_id(self, subscription_id: str | UUID) -> SubscriptionDTO | None:
        subscription = await self.crud.get_by_id(subscription_id)
        if subscription is None:
            return None
        return SubscriptionDTO.model_validate(subscription)

    async def get_all(self, **kwargs) -> list[SubscriptionDTO]:
        subscriptions = await self.crud.get_all(**kwargs)
        return [SubscriptionDTO.model_validate(s) for s in subscriptions]

    async def query_by_id(self, subscription_id: str | UUID, fields: FieldSpec | None = None) -> Subscription | None:
        return await self.crud.get_by_id(subscription_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[Subscription]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(
        self,
        requester: UserDTO,
        entity_type: str,
        entity_id: UUID | str | None = None,
        user_id: UUID | str | None = None,
    ) -> Subscription:
        target_user_id = user_id or str(requester.id)

        body = {
            "user_id": target_user_id,
            "entity_type": entity_type,
            "entity_id": entity_id,
        }
        created_subscription = await self.crud.create(body)
        dto = SubscriptionDTO.model_validate(created_subscription)
        subscription = await self.query_by_id(dto.id)
        if not subscription:
            raise EntityNotFound("Subscription not found")
        return subscription

    async def delete(self, subscription_id: str | UUID) -> None:
        subscription = await self.query_by_id(subscription_id)
        if not subscription:
            raise EntityNotFound("Subscription not found")

        await self.crud.delete(subscription)

    async def delete_many_by_entity_id(self, entity_type: str, entity_id: str) -> None:
        await self.crud.delete_many_by_entity_id(entity_type, entity_id)


class NotificationPreferenceService:
    def __init__(self, crud: NotificationPreferenceCRUD):
        self.crud: NotificationPreferenceCRUD = crud

    async def get_by_id(self, preference_id: str | UUID) -> NotificationPreferenceDTO | None:
        preference = await self.crud.get_by_id(preference_id)
        if preference is None:
            return None
        return NotificationPreferenceDTO.model_validate(preference)

    async def get_all(self, **kwargs) -> list[NotificationPreferenceDTO]:
        preferences = await self.crud.get_all(**kwargs)
        return [NotificationPreferenceDTO.model_validate(p) for p in preferences]

    async def query_by_id(
        self, preference_id: str | UUID, fields: FieldSpec | None = None
    ) -> NotificationPreference | None:
        return await self.crud.get_by_id(preference_id, fields=fields)

    async def query_all(
        self,
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] | None = None,
        sort: tuple[str, str] | None = None,
        fields: FieldSpec | None = None,
    ) -> list[NotificationPreference]:
        return await self.crud.get_all(filter=filter, range=range, sort=sort, fields=fields)

    async def count(self, filter: dict[str, Any] | None = None) -> int:
        return await self.crud.count(filter=filter)

    async def create(
        self,
        requester: UserDTO,
        event_type: str,
        channels: list[Any],
        user_id: str | None = None,
    ) -> NotificationPreference:
        target_user_id = str(requester.id)
        if user_id and user_id != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can create notification preferences for other users")
            target_user_id = user_id

        body = {
            "user_id": target_user_id,
            "event_type": event_type,
            "channels": channels,
        }
        created_preference = await self.crud.create(body)
        dto = NotificationPreferenceDTO.model_validate(created_preference)
        preference = await self.query_by_id(dto.id)
        if not preference:
            raise EntityNotFound("Notification preference not found")
        return preference

    async def delete(self, requester: UserDTO, preference_id: str | UUID) -> None:
        preference = await self.query_by_id(preference_id)
        if not preference:
            raise EntityNotFound("Notification preference not found")

        if str(preference.user_id) != str(requester.id):
            if not await user_is_super_admin(requester):
                raise AccessDenied("Only super admins can delete notification preferences of other users")

        await self.crud.delete(preference)
