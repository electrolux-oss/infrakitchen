from typing import Any

from core.database import FieldSpec, build_load_only
from core.workers.model import Worker


def build_worker_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Worker based on requested fields."""
    if fields is None:
        return []
    return build_load_only(Worker, set(fields.keys()))
