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


def blueprint_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Blueprint, fields)
    if "templates" in fields:
        opts.append(selectinload(Blueprint.templates).noload("*"))
    if "workflows" in fields:
        wf_load = selectinload(Blueprint.workflows)
        opts.append(wf_load.selectinload(Workflow.creator))
        step_load = wf_load.selectinload(Workflow.steps)
        opts.append(step_load.selectinload(WorkflowStep.integration_ids))
        opts.append(step_load.selectinload(WorkflowStep.secret_ids))
        opts.append(step_load.joinedload(WorkflowStep.template).noload("*"))
        opts.append(step_load.joinedload(WorkflowStep.source_code_version).noload("*"))
        opts.append(step_load.selectinload(WorkflowStep.parent_resources).noload("*"))
        step_resource = step_load.joinedload(WorkflowStep.resource)
        opts.append(step_resource.joinedload(Resource.template).noload("*"))
        opts.append(step_resource)
    return opts


def convert_blueprint(obj: Any, fields: set[str] | None = None) -> BlueprintType | None:
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
            [x for x in (convert_workflow(w) for w in getattr(obj, "workflows", []) or []) if x is not None]
            if fields is None or "workflows" in fields
            else None
        ),
        created_at=obj.created_at,
        updated_at=obj.updated_at,
    )
