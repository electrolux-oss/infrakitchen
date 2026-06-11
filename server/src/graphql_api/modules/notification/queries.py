import uuid
from typing import Any, cast

import strawberry
from strawberry.scalars import JSON
from strawberry.types import Info

from core.notifications.dependencies import (
    get_subscription_service,
    get_notification_preference_service,
)
from graphql_api.helpers import (
    IsAuthenticated,
    build_field_spec,
    get_entity_selection,
    parse_range,
    parse_sort,
)
from graphql_api.modules.notification.types import SubscriptionType, NotificationPreferenceType


@strawberry.type
class NotificationQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def subscription(self, info: Info, id: uuid.UUID) -> SubscriptionType | None:
        session = info.context["session"]
        service = get_subscription_service(session)
        entity_fields = get_entity_selection(info.selected_fields, "subscription")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def subscriptions(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[SubscriptionType]:
        session = info.context["session"]
        service = get_subscription_service(session)
        entity_fields = get_entity_selection(info.selected_fields, "subscriptions")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def subscriptions_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        session = info.context["session"]
        service = get_subscription_service(session)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def notification_preference(self, info: Info, id: uuid.UUID) -> NotificationPreferenceType | None:
        session = info.context["session"]
        service = get_notification_preference_service(session)
        entity_fields = get_entity_selection(info.selected_fields, "notificationPreference")
        fields = build_field_spec(entity_fields)
        return await service.query_by_id(id, fields=fields)

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def notification_preferences(
        self,
        info: Info,
        filter: JSON | None = None,
        sort: list[str] | None = None,
        range: list[int] | None = None,
    ) -> list[NotificationPreferenceType]:
        session = info.context["session"]
        service = get_notification_preference_service(session)
        entity_fields = get_entity_selection(info.selected_fields, "notificationPreferences")
        fields = build_field_spec(entity_fields)
        return await service.query_all(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
            sort=parse_sort(sort),
            range=parse_range(range),
            fields=fields,
        )

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def notification_preferences_count(
        self,
        info: Info,
        filter: JSON | None = None,
    ) -> int:
        session = info.context["session"]
        service = get_notification_preference_service(session)
        return await service.count(
            filter=cast(dict[str, Any], cast(object, filter)) if filter else None,
        )
