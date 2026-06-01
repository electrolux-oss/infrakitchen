from typing import Any

from sqlalchemy.orm import joinedload, noload

from application.integrations.query_options import build_integration_query_options
from application.secrets.model import Secret
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_secret_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Secret based on requested fields."""
    if fields is None:
        return [
            joinedload(Secret.integration),
            joinedload(Secret.creator),
        ]

    opts: list[Any] = build_load_only(Secret, set(fields.keys()))

    if "integration" in fields:
        nested = fields["integration"]
        opts.append(joinedload(Secret.integration).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(Secret.integration))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Secret.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Secret.creator))

    return opts
