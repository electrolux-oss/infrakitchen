from typing import Any

from core.database import FieldSpec, build_load_only

from .model import TaskQueueItem

# GraphQL fields computed from other columns; those columns must be loaded too,
# otherwise the resolver would trigger a lazy load outside the async context.
COMPUTED_FIELD_COLUMNS: dict[str, tuple[str, ...]] = {
    "entityData": ("entity", "entity_id"),
    "creator": ("created_by",),
    "workerHost": ("worker_id",),
}


def build_task_queue_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for TaskQueueItem based on requested fields."""
    if fields is None:
        return []
    columns = set(fields.keys())
    for field in fields:
        columns.update(COMPUTED_FIELD_COLUMNS.get(field, ()))
    return build_load_only(TaskQueueItem, columns)
