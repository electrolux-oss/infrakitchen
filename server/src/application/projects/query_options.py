from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from application.workspaces.query_options import build_workspace_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Project


def build_project_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options based on requested field spec."""
    if fields is None:
        return [
            joinedload(Project.workspace),
            joinedload(Project.creator),
            selectinload(Project.owners),
        ]

    opts: list[Any] = build_load_only(Project, set(fields.keys()))

    if "workspace" in fields:
        nested = fields["workspace"]
        opts.append(joinedload(Project.workspace).options(*build_workspace_query_options(nested)))
    else:
        opts.append(noload(Project.workspace))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Project.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Project.creator))

    if "owners" in fields:
        nested = fields["owners"]
        opts.append(selectinload(Project.owners).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Project.owners))

    return opts
