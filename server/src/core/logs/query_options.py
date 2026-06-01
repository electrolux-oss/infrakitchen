from typing import Any

from core.database import FieldSpec, build_load_only
from core.logs.model import Log


def build_log_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Log based on requested fields."""
    if fields is None:
        return []
    return build_load_only(Log, set(fields.keys()))
