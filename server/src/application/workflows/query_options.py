from __future__ import annotations

from typing import Any

from sqlalchemy.orm import joinedload, noload, selectinload

from application.integrations.query_options import build_integration_query_options
from application.secrets.query_options import build_secret_query_options
from application.source_code_versions.query_options import build_source_code_version_query_options
from application.templates.query_options import build_template_query_options
from application.workflows.model import Workflow, WorkflowStep
from core.database import FieldSpec, build_load_only
from core.users.query_options import build_user_query_options


def build_workflow_step_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for WorkflowStep based on requested fields."""
    from application.resources.query_options import build_resource_query_options

    if fields is None:
        return [
            selectinload(WorkflowStep.integration_ids),
            selectinload(WorkflowStep.secret_ids),
            selectinload(WorkflowStep.template),
            selectinload(WorkflowStep.source_code_version),
            selectinload(WorkflowStep.parent_resource_ids),
            selectinload(WorkflowStep.resource),
        ]

    opts: list[Any] = []

    if "integrationIds" in fields or "integration_ids" in fields:
        nested = fields.get("integrationIds") or fields.get("integration_ids")
        opts.append(selectinload(WorkflowStep.integration_ids).options(*build_integration_query_options(nested)))
    else:
        opts.append(noload(WorkflowStep.integration_ids))

    if "secretIds" in fields or "secret_ids" in fields:
        nested = fields.get("secretIds") or fields.get("secret_ids")
        opts.append(selectinload(WorkflowStep.secret_ids).options(*build_secret_query_options(nested)))
    else:
        opts.append(noload(WorkflowStep.secret_ids))

    if "template" in fields:
        nested = fields["template"]
        opts.append(selectinload(WorkflowStep.template).options(*build_template_query_options(nested)))
    else:
        opts.append(noload(WorkflowStep.template))

    if "sourceCodeVersion" in fields or "source_code_version" in fields:
        nested = fields.get("sourceCodeVersion") or fields.get("source_code_version")
        opts.append(
            selectinload(WorkflowStep.source_code_version).options(*build_source_code_version_query_options(nested))
        )
    else:
        opts.append(noload(WorkflowStep.source_code_version))

    if "parentResourceIds" in fields or "parent_resource_ids" in fields:
        nested = fields.get("parentResourceIds") or fields.get("parent_resource_ids")
        opts.append(selectinload(WorkflowStep.parent_resource_ids).options(*build_resource_query_options(nested)))
    else:
        opts.append(noload(WorkflowStep.parent_resource_ids))

    if "resource" in fields:
        nested = fields["resource"]
        opts.append(selectinload(WorkflowStep.resource).options(*build_resource_query_options(nested)))
    else:
        opts.append(noload(WorkflowStep.resource))

    return opts


def build_workflow_query_options(fields: FieldSpec | None = None) -> list[Any]:
    """Build SQLAlchemy loading options for Workflow based on requested fields."""
    if fields is None:
        return [
            joinedload(Workflow.creator),
            selectinload(Workflow.steps),
        ]

    opts: list[Any] = build_load_only(Workflow, set(fields.keys()))

    if "creator" in fields:
        nested = fields["creator"]
        opts.append(joinedload(Workflow.creator).options(*build_user_query_options(nested)))
    else:
        opts.append(noload(Workflow.creator))

    if "steps" in fields:
        nested = fields["steps"]
        opts.append(selectinload(Workflow.steps).options(*build_workflow_step_query_options(nested)))
    else:
        opts.append(noload(Workflow.steps))

    return opts
