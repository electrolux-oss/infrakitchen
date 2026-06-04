from typing import Any

from sqlalchemy.orm import noload, selectinload

from application.integrations.query_options import build_integration_query_options
from application.workspaces.model import Workspace
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_workspace_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Workspace based on requested fields."""
    if fields is None:
        return [
            selectinload(Workspace.integration),
            selectinload(Workspace.creator),
        ]

    opts: list[Any] = build_load_only(Workspace, set(fields.keys()))

    if "integration" in fields:
        nested = fields["integration"]
        opts.append(selectinload(Workspace.integration).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(Workspace.integration))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(selectinload(Workspace.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Workspace.creator))

    return opts
