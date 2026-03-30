from typing import Any

from sqlalchemy.orm import selectinload

from application.integrations.model import Integration
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.integration.types import IntegrationType
from graphql_api.modules.user.converters import convert_user


def integration_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Integration, fields)
    if "creator" in fields:
        opts.append(selectinload(Integration.creator))
    return opts


def convert_integration(obj: Any, fields: set[str] | None = None) -> IntegrationType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return IntegrationType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        integration_type=obj.integration_type,
        integration_provider=obj.integration_provider,
        configuration=obj.configuration,
        labels=obj.labels,
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
