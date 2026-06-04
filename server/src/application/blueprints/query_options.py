from typing import Any

from sqlalchemy.orm import noload, selectinload

from application.blueprints.model import Blueprint
from application.templates.query_options import build_template_query_options
from application.workflows.query_options import build_workflow_query_options
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_blueprint_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Blueprint based on requested fields."""
    if fields is None:
        return [
            selectinload(Blueprint.templates),
            selectinload(Blueprint.external_templates),
            selectinload(Blueprint.creator),
            selectinload(Blueprint.workflows),
        ]

    opts: list[Any] = build_load_only(Blueprint, set(fields.keys()))

    if "templates" in fields:
        nested = fields["templates"]
        opts.append(selectinload(Blueprint.templates).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(Blueprint.templates))

    if "externalTemplates" in fields or "external_templates" in fields:
        nested = fields.get("externalTemplates") or fields.get("external_templates")
        opts.append(selectinload(Blueprint.external_templates).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(Blueprint.external_templates))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(selectinload(Blueprint.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Blueprint.creator))

    if "workflows" in fields:
        nested = fields["workflows"]
        opts.append(selectinload(Blueprint.workflows).options(*build_workflow_query_options(nested)))
    else:
        opts.append(noload(Blueprint.workflows))

    return opts
