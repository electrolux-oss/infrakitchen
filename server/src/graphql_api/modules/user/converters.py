from typing import Any

from graphql_api.modules.user.types import UserType


def convert_user(obj: Any) -> UserType | None:
    if obj is None:
        return None
    return UserType(
        id=obj.id,
        email=obj.email,
        identifier=obj.identifier,
        first_name=obj.first_name,
        last_name=obj.last_name,
        display_name=obj.display_name,
        provider=obj.provider,
        deactivated=obj.deactivated,
        description=obj.description,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
