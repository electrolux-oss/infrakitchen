from typing import Any

from sqlalchemy.orm import joinedload, noload

from core.audit_logs.model import AuditLog
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_audit_log_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for AuditLog based on requested fields."""
    if fields is None:
        return [
            joinedload(AuditLog.creator),
        ]

    opts: list[Any] = build_load_only(AuditLog, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(AuditLog.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(AuditLog.creator))

    return opts
