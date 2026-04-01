from typing import Any

from sqlalchemy.orm import selectinload

from application.resources.model import Resource
from application.workflows.model import Workflow, WorkflowStep
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.integration.converters import convert_integration
from graphql_api.modules.resource.converters import _convert_resource_shallow
from graphql_api.modules.secret.converters import convert_secret
from graphql_api.modules.source_code_version.converters import convert_source_code_version
from graphql_api.modules.template.converters import convert_template_shallow
from graphql_api.modules.user.converters import convert_user
from graphql_api.modules.workflow.types import WorkflowStepType, WorkflowType


# Fields to pass to nested converters so they only touch eagerly-loaded columns
_NESTED_INTEGRATION_FIELDS: set[str] = {"id", "name", "integrationProvider"}
_NESTED_SECRET_FIELDS: set[str] = {"id", "name", "secretProvider"}
_NESTED_SCV_FIELDS: set[str] = {"id", "sourceCodeVersion", "sourceCodeBranch"}


def workflow_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Workflow, fields)
    if "creator" in fields:
        opts.append(selectinload(Workflow.creator))
    if "steps" in fields:
        step_load = selectinload(Workflow.steps)
        opts.append(step_load.selectinload(WorkflowStep.integration_ids))
        opts.append(step_load.selectinload(WorkflowStep.secret_ids))
        opts.append(step_load.joinedload(WorkflowStep.template).noload("*"))
        opts.append(step_load.joinedload(WorkflowStep.source_code_version).noload("*"))
        opts.append(step_load.selectinload(WorkflowStep.parent_resources).noload("*"))
        step_resource = step_load.joinedload(WorkflowStep.resource)
        opts.append(step_resource.joinedload(Resource.template).noload("*"))
        opts.append(step_resource)
    return opts


def convert_workflow_step(obj: Any) -> WorkflowStepType:
    resource_obj = getattr(obj, "resource", None)
    resource_type = None
    if resource_obj is not None:
        resource_type = _convert_resource_shallow(resource_obj)
        # Attach the eagerly-loaded template if present
        tmpl = getattr(resource_obj, "template", None)
        if tmpl is not None:
            resource_type.template = convert_template_shallow(tmpl)

    # Convert source_code_version
    scv_obj = getattr(obj, "source_code_version", None)
    scv_type = convert_source_code_version(scv_obj, _NESTED_SCV_FIELDS) if scv_obj is not None else None

    # Convert parent_resources
    parent_res = [_convert_resource_shallow(r) for r in getattr(obj, "parent_resources", []) or []]

    return WorkflowStepType(
        id=obj.id,
        workflow_id=obj.workflow_id,
        template_id=obj.template_id,
        template=convert_template_shallow(getattr(obj, "template", None)),
        resource_id=obj.resource_id,
        resource=resource_type,
        source_code_version_id=obj.source_code_version_id,
        source_code_version=scv_type,
        parent_resource_ids=obj.parent_resource_ids,
        parent_resources=parent_res,
        integration_ids=[
            x
            for x in (
                convert_integration(i, _NESTED_INTEGRATION_FIELDS) for i in getattr(obj, "integration_ids", []) or []
            )
            if x is not None
        ],
        secret_ids=[
            x
            for x in (convert_secret(s, _NESTED_SECRET_FIELDS) for s in getattr(obj, "secret_ids", []) or [])
            if x is not None
        ],
        storage_id=obj.storage_id,
        position=obj.position,
        status=enum_val(obj.status),
        error_message=obj.error_message,
        resolved_variables=obj.resolved_variables,
        started_at=obj.started_at,
        completed_at=obj.completed_at,
    )


def convert_workflow(obj: Any, fields: set[str] | None = None) -> WorkflowType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return WorkflowType(
        id=obj.id,
        wiring_snapshot=obj.wiring_snapshot,
        variable_overrides=obj.variable_overrides,
        status=enum_val(obj.status),
        error_message=obj.error_message,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        steps=(
            [convert_workflow_step(s) for s in getattr(obj, "steps", []) or []]
            if fields is None or "steps" in fields
            else []
        ),
        started_at=obj.started_at,
        completed_at=obj.completed_at,
        created_at=obj.created_at,
    )
