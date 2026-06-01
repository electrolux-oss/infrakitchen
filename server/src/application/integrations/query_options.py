from typing import Any

from sqlalchemy.orm import joinedload, noload

from application.integrations.model import Integration
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_integration_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Integration based on requested fields."""
    if fields is None:
        return [
            joinedload(Integration.creator),
        ]

    opts: list[Any] = build_load_only(Integration, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Integration.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Integration.creator))

    return opts
