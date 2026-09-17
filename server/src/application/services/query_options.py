from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from application.projects.query_options import build_project_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Service


def build_service_query_options(fields: FieldSpec | None = None) -> list[Any]:
    if fields is None:
        return [
            joinedload(Service.project),
            joinedload(Service.creator),
            selectinload(Service.owners),
        ]

    opts: list[Any] = build_load_only(Service, set(fields.keys()))

    if "project" in fields:
        nested = fields["project"]
        opts.append(joinedload(Service.project).options(*build_project_query_options(nested)))
    else:
        opts.append(noload(Service.project))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Service.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Service.creator))

    if "owners" in fields:
        nested = fields["owners"]
        opts.append(selectinload(Service.owners).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Service.owners))

    return opts
