from typing import Any

from sqlalchemy.orm import joinedload, noload

from application.integrations.query_options import build_integration_query_options
from application.source_codes.model import SourceCode
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_source_code_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for SourceCode based on requested fields."""
    if fields is None:
        return [
            joinedload(SourceCode.integration),
            joinedload(SourceCode.creator),
        ]

    opts: list[Any] = build_load_only(SourceCode, set(fields.keys()))

    if "integration" in fields:
        nested = fields["integration"]
        opts.append(joinedload(SourceCode.integration).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(SourceCode.integration))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(SourceCode.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(SourceCode.creator))

    return opts
