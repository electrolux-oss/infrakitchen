from typing import Any

from sqlalchemy.orm import joinedload, raiseload

from core.audit_logs.model import AuditLog
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_audit_log_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for AuditLog based on requested fields."""
    if fields is None:
        return [
            joinedload(AuditLog.creator),
        ]

    requested: set[str] = set(fields.keys())
    if "metadata" in requested:
        requested.add("action_metadata")

    opts: list[Any] = build_load_only(AuditLog, requested)

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(AuditLog.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(raiseload(AuditLog.creator))

    return opts
