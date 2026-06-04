from typing import Any

from sqlalchemy.orm import joinedload, noload

from application.integrations.query_options import build_integration_query_options
from application.storages.model import Storage
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_storage_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Storage based on requested fields."""
    if fields is None:
        return [
            joinedload(Storage.integration),
            joinedload(Storage.creator),
        ]

    opts: list[Any] = build_load_only(Storage, set(fields.keys()))

    if "integration" in fields:
        nested = fields["integration"]
        opts.append(joinedload(Storage.integration).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(Storage.integration))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Storage.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Storage.creator))

    return opts
