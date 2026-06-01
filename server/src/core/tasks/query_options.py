from typing import Any

from sqlalchemy.orm import joinedload, noload

from core.database import FieldSpec, build_load_only
from core.tasks.model import TaskEntity
from core.users.query_options import build_user_query_options


def build_task_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for TaskEntity based on requested fields."""

    if fields is None:
        return [
            joinedload(TaskEntity.creator),
        ]

    opts: list[Any] = build_load_only(TaskEntity, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(TaskEntity.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(TaskEntity.creator))

    return build_load_only(TaskEntity, set(fields.keys()))
