from typing import Any

from sqlalchemy.orm import joinedload, raiseload, selectinload

from application.integrations.query_options import build_integration_query_options
from application.projects.query_options import build_project_query_options
from application.source_codes.query_options import build_source_code_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options

from .model import Service


def build_service_query_options(fields: FieldSpec | None = None) -> list[Any]:
    if fields is None:
        return [
            joinedload(Service.project),
            joinedload(Service.source_code),
            joinedload(Service.registry_integration),
            joinedload(Service.creator),
            selectinload(Service.owners),
        ]

    opts: list[Any] = build_load_only(Service, set(fields.keys()))

    if "project" in fields:
        nested = fields["project"]
        opts.append(joinedload(Service.project).options(*build_project_query_options(nested)))
    else:
        opts.append(raiseload(Service.project))

    if "sourceCode" in fields:
        nested = fields["sourceCode"]
        opts.append(joinedload(Service.source_code).options(*build_source_code_query_options(nested)))
    else:
        opts.append(raiseload(Service.source_code))

    if "registryIntegration" in fields:
        nested = fields["registryIntegration"]
        opts.append(joinedload(Service.registry_integration).options(*build_integration_query_options(nested)))
    else:
        opts.append(raiseload(Service.registry_integration))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Service.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(raiseload(Service.creator))

    if "owners" in fields:
        nested = fields["owners"]
        opts.append(selectinload(Service.owners).options(*build_user_query_options(nested)))
    else:
        opts.append(raiseload(Service.owners))

    return opts
