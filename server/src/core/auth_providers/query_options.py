from typing import Any

from sqlalchemy.orm import joinedload, noload

from core.auth_providers.model import AuthProvider
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_auth_provider_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for AuthProvider based on requested fields."""
    if fields is None:
        return [
            joinedload(AuthProvider.creator),
        ]

    opts: list[Any] = build_load_only(AuthProvider, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(AuthProvider.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(AuthProvider.creator))

    return opts
