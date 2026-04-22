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


def workflow_options(fields: set[str], step_fields: set[str] | None = None) -> list[Any]:
    """Build SQLAlchemy eager-load options for Workflow based on requested fields.

    Args:
        fields: Top-level workflow fields requested by the GraphQL query.
        step_fields: Fields requested inside ``steps``.  When *None* all step
            relationships are loaded (backward-compatible fallback).
    """
    opts: list[Any] = build_load_only(Workflow, fields)
    if "creator" in fields:
        opts.append(selectinload(Workflow.creator))
    if "steps" in fields:
        step_load = selectinload(Workflow.steps)
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


def convert_workflow_step(obj: Any, fields: set[str] | None = None) -> WorkflowStepType:
    """Convert a WorkflowStep ORM object.

    Args:
        obj: The ORM ``WorkflowStep`` instance.
        fields: Step-level GraphQL field names.  When *None* all nested
            relationships are converted (backward-compatible fallback).
    """
    resource_type = None
    if fields is None or "resource" in fields:
        resource_obj = getattr(obj, "resource", None)
        if resource_obj is not None:
            resource_type = _convert_resource_shallow(resource_obj)
            tmpl = getattr(resource_obj, "template", None)
            if tmpl is not None:
                resource_type.template = convert_template_shallow(tmpl)

    scv_type = None
    if fields is None or "sourceCodeVersion" in fields:
        scv_obj = getattr(obj, "source_code_version", None)
        scv_type = convert_source_code_version(scv_obj, _NESTED_SCV_FIELDS) if scv_obj is not None else None

    parent_res: list[Any] = []
    if fields is None or "parentResources" in fields:
        parent_res = [_convert_resource_shallow(r) for r in getattr(obj, "parent_resources", []) or []]

    template = None
    if fields is None or "template" in fields:
        template = convert_template_shallow(getattr(obj, "template", None))

    integration_ids: list[Any] = []
    if fields is None or "integrationIds" in fields:
        integration_ids = [
            x
            for x in (
                convert_integration(i, _NESTED_INTEGRATION_FIELDS) for i in getattr(obj, "integration_ids", []) or []
            )
            if x is not None
        ]

    secret_ids: list[Any] = []
    if fields is None or "secretIds" in fields:
        secret_ids = [
            x
            for x in (convert_secret(s, _NESTED_SECRET_FIELDS) for s in getattr(obj, "secret_ids", []) or [])
            if x is not None
        ]

    return WorkflowStepType(
        id=obj.id,
        workflow_id=obj.workflow_id,
        template_id=obj.template_id,
        template=template,
        resource_id=obj.resource_id,
        resource=resource_type,
        source_code_version_id=obj.source_code_version_id,
        source_code_version=scv_type,
        parent_resource_ids=obj.parent_resource_ids,
        parent_resources=parent_res,
        integration_ids=integration_ids,
        secret_ids=secret_ids,
        storage_id=obj.storage_id,
        position=obj.position,
        status=enum_val(obj.status),
        error_message=obj.error_message,
        resolved_variables=obj.resolved_variables,
        started_at=obj.started_at,
        completed_at=obj.completed_at,
    )


def convert_workflow(
    obj: Any,
    fields: set[str] | None = None,
    step_fields: set[str] | None = None,
) -> WorkflowType | None:
    if obj is None:
        return None
    if fields is not None:
        obj = SafeORM(obj)
    return WorkflowType(
        id=obj.id,
        action=enum_val(obj.action) if hasattr(obj, "action") else "create",
        wiring_snapshot=obj.wiring_snapshot,
        status=enum_val(obj.status),
        error_message=obj.error_message,
        created_by=obj.created_by,
        creator=convert_user(obj.creator) if fields is None or "creator" in fields else None,
        steps=(
            [convert_workflow_step(s, step_fields) for s in getattr(obj, "steps", []) or []]
            if fields is None or "steps" in fields
            else []
        ),
        started_at=obj.started_at,
        completed_at=obj.completed_at,
        created_at=obj.created_at,
    )
