from __future__ import annotations

from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from application.integrations.query_options import build_integration_query_options
from application.resources.model import Resource
from application.secrets.query_options import build_secret_query_options
from application.source_code_versions.query_options import build_source_code_version_query_options
from application.storages.query_options import build_storage_query_options
from application.templates.query_options import build_template_query_options
from application.workspaces.query_options import build_workspace_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_resource_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Resource based on requested fields."""
    if fields is None:
        return [
            selectinload(Resource.integration_ids),
            selectinload(Resource.secret_ids),
            selectinload(Resource.parents),
            selectinload(Resource.children),
            joinedload(Resource.template),
            joinedload(Resource.workspace),
            joinedload(Resource.source_code_version),
            joinedload(Resource.storage),
            joinedload(Resource.creator),
        ]

    opts: list[Any] = build_load_only(Resource, set(fields.keys()))

    if "integrationIds" in fields or "integration_ids" in fields:
        nested = fields.get("integrationIds") or fields.get("integration_ids")
        opts.append(selectinload(Resource.integration_ids).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(Resource.integration_ids))

    if "secretIds" in fields or "secret_ids" in fields:
        nested = fields.get("secretIds") or fields.get("secret_ids")
        opts.append(selectinload(Resource.secret_ids).options(*build_secret_query_options(nested)))
    else:
        opts.append(noload(Resource.secret_ids))

    if "parents" in fields:
        nested = fields["parents"]
        opts.append(selectinload(Resource.parents).options(*build_resource_query_options(nested)))
    else:
        opts.append(noload(Resource.parents))

    if "children" in fields:
        nested = fields["children"]
        opts.append(selectinload(Resource.children).options(*build_resource_query_options(nested)))
    else:
        opts.append(noload(Resource.children))

    if "template" in fields:
        nested = fields["template"]
        opts.append(joinedload(Resource.template).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(Resource.template))

    if "workspace" in fields:
        nested = fields["workspace"]
        opts.append(joinedload(Resource.workspace).options(*build_workspace_query_options(nested)))
    else:
        opts.append(noload(Resource.workspace))

    if "sourceCodeVersion" in fields or "source_code_version" in fields:
        nested = fields.get("sourceCodeVersion") or fields.get("source_code_version")
        opts.append(joinedload(Resource.source_code_version).options(*build_source_code_version_query_options(nested)))
    else:
        opts.append(noload(Resource.source_code_version))

    if "storage" in fields:
        nested = fields["storage"]
        opts.append(joinedload(Resource.storage).options(*build_storage_query_options(nested)))
    else:
        opts.append(noload(Resource.storage))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Resource.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Resource.creator))

    return opts
