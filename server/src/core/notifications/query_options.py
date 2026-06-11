from typing import Any

from sqlalchemy.orm import joinedload, noload

from .model import Subscription, NotificationPreference
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_subscription_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Subscription based on requested fields."""
    if fields is None:
        return [
            joinedload(Subscription.user),
        ]

    columns = set(fields.keys())
    if "user" in columns:
        columns.add("user_id")
    if "entityData" in columns:
        columns.add("entity_id")
        columns.add("entity_type")
    opts: list[Any] = build_load_only(Subscription, columns)

    if "user" in fields:
        nested = fields["user"]
        opts.append(joinedload(Subscription.user).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Subscription.user))

    return opts


def build_notification_preference_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for NotificationPreference based on requested fields."""
    if fields is None:
        return [
            joinedload(NotificationPreference.user),
        ]

    columns = set(fields.keys())
    if "user" in columns:
        columns.add("user_id")

    opts: list[Any] = build_load_only(NotificationPreference, columns)

    if "user" in fields:
        nested = fields["user"]
        opts.append(joinedload(NotificationPreference.user).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(NotificationPreference.user))

    return opts
