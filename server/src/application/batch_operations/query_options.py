from typing import Any

from sqlalchemy.orm import joinedload, noload

from application.batch_operations.model import BatchOperation
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_batch_operation_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for BatchOperation based on requested fields."""
    if fields is None:
        return [
            joinedload(BatchOperation.creator),
        ]

    opts: list[Any] = build_load_only(BatchOperation, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(BatchOperation.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(BatchOperation.creator))

    return opts
