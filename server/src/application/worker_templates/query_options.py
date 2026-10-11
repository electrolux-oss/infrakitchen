from typing import Any

from sqlalchemy.orm import joinedload, raiseload

from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import WorkerTemplate


def build_worker_template_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for WorkerTemplate based on requested fields."""
    if fields is None:
        return [joinedload(WorkerTemplate.creator)]

    opts: list[Any] = build_load_only(WorkerTemplate, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(WorkerTemplate.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(raiseload(WorkerTemplate.creator))

    return opts
