from typing import Any

from sqlalchemy.orm import joinedload, raiseload, selectinload

from application.projects.query_options import build_project_query_options
from application.source_codes.query_options import build_source_code_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Service


def build_service_query_options(fields: FieldSpec | None = None) -> list[Any]:
    if fields is None:
        return [
            joinedload(Service.project),
            joinedload(Service.creator),
            joinedload(Service.source_code),
            selectinload(Service.owners),
        ]

    opts: list[Any] = build_load_only(Service, set(fields.keys()))

    if "project" in fields:
        nested = fields["project"]
        opts.append(joinedload(Service.project).options(*build_project_query_options(nested)))
    else:
        opts.append(raiseload(Service.project))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Service.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(raiseload(Service.creator))

    if "sourceCode" in fields or "source_code" in fields:
        nested = fields.get("sourceCode") or fields.get("source_code")
        opts.append(joinedload(Service.source_code).options(*build_source_code_query_options(nested)))
    else:
        opts.append(raiseload(Service.source_code))

    if "owners" in fields:
        nested = fields["owners"]
        opts.append(selectinload(Service.owners).options(*build_user_query_options(nested)))
    else:
        opts.append(raiseload(Service.owners))

    return opts
