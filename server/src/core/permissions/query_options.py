from typing import Any

from sqlalchemy.orm import joinedload, noload

from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Permission


def build_permission_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options based on requested field spec.

    The computed GraphQL fields ``userData`` and ``entityData`` read from the
    ``v0`` / ``v1`` columns respectively, so we ensure those columns are
    always present in the load-only set when the computed fields are requested.
    """
    if fields is None:
        return [
            joinedload(Permission.creator),
        ]

    # Ensure v0/v1 columns are loaded when computed fields reference them.
    columns = set(fields.keys())
    if "userData" in columns:
        columns.add("v0")
    if "entityData" in columns:
        columns.add("v1")

    opts: list[Any] = build_load_only(Permission, columns)

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Permission.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Permission.creator))

    return opts
