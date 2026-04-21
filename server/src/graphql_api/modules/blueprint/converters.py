from typing import Any

from sqlalchemy.orm import selectinload

from application.blueprints.model import Blueprint
from application.resources.model import Resource
from application.workflows.model import Workflow, WorkflowStep
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.blueprint.types import BlueprintType
from graphql_api.modules.template.converters import convert_template_shallow
from graphql_api.modules.user.converters import convert_user
from graphql_api.modules.workflow.converters import convert_workflow


def blueprint_options(
    fields: set[str],
    workflow_fields: set[str] | None = None,
    step_fields: set[str] | None = None,
) -> list[Any]:
    """Build SQLAlchemy eager-load options for Blueprint based on requested fields.

    Args:
        fields: Top-level blueprint fields from the GraphQL query.
        workflow_fields: Fields requested inside ``workflows``.
        step_fields: Fields requested inside ``workflows.steps``.
    """
    opts: list[Any] = build_load_only(Blueprint, fields)
    if "templates" in fields:
        opts.append(selectinload(Blueprint.templates).noload("*"))
    if "workflows" in fields:
        wf_load = selectinload(Blueprint.workflows)
        if workflow_fields is None or "creator" in workflow_fields:
            opts.append(wf_load.selectinload(Workflow.creator))
        if workflow_fields is None or "steps" in workflow_fields:
            step_load = wf_load.selectinload(Workflow.steps)
            if step_fields is None or "integrationIds" in step_fields:
                opts.append(step_load.selectinload(WorkflowStep.integration_ids))
            if step_fields is None or "secretIds" in step_fields:
                opts.append(step_load.selectinload(WorkflowStep.secret_ids))
            if step_fields is None or "template" in step_fields:
                opts.append(step_load.joinedload(WorkflowStep.template).noload("*"))
            if step_fields is None or "sourceCodeVersion" in step_fields:
                opts.append(step_load.joinedload(WorkflowStep.source_code_version).noload("*"))
            if step_fields is None or "parentResources" in step_fields:
                opts.append(step_load.selectinload(WorkflowStep.parent_resources).noload("*"))
            if step_fields is None or "resource" in step_fields:
                step_resource = step_load.joinedload(WorkflowStep.resource)
                opts.append(step_resource.joinedload(Resource.template).noload("*"))
                opts.append(step_resource)
    return opts


def convert_blueprint(
    obj: Any,
    fields: set[str] | None = None,
    workflow_fields: set[str] | None = None,
    step_fields: set[str] | None = None,
) -> BlueprintType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return BlueprintType(
        id=obj.id,
        name=obj.name,
        description=obj.description,
        templates=(
            [x for x in (convert_template_shallow(t) for t in getattr(obj, "templates", []) or []) if x is not None]
            if fields is None or "templates" in fields
            else []
        ),
        wiring=obj.wiring,
        default_variables=obj.default_variables,
        configuration=obj.configuration,
        labels=obj.labels,
        status=enum_val(obj.status),
        revision_number=obj.revision_number,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        workflows=(
            [
                x
                for x in (
                    convert_workflow(w, workflow_fields, step_fields) for w in getattr(obj, "workflows", []) or []
                )
                if x is not None
            ]
            if fields is None or "workflows" in fields
            else None
        ),
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
