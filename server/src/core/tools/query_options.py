from typing import Any

from sqlalchemy.orm import joinedload, noload

from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Tool


def build_tool_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Tool based on requested fields."""
    if fields is None:
        return [joinedload(Tool.creator)]

    opts: list[Any] = build_load_only(Tool, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Tool.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Tool.creator))

    return opts
