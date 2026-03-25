from typing import Any

from sqlalchemy.orm import selectinload

from application.storages.model import Storage
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.integration.converters import convert_integration
from graphql_api.modules.storage.types import StorageType
from graphql_api.modules.user.converters import convert_user


def storage_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Storage, fields)
    if "integration" in fields:
        opts.append(selectinload(Storage.integration).noload("*"))
    if "creator" in fields:
        opts.append(selectinload(Storage.creator))
    return opts


def convert_storage(obj: Any, fields: set[str] | None = None) -> StorageType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return StorageType(
        id=obj.id,
        name=obj.name,
        storage_type=obj.storage_type,
        storage_provider=obj.storage_provider,
        integration_id=obj.integration_id,
        integration=(
            convert_integration(getattr(obj, "integration", None))
            if fields is None or "integration" in fields
            else None
        ),
        configuration=obj.configuration,
        description=obj.description,
        labels=obj.labels,
        state=enum_val(obj.state),
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
