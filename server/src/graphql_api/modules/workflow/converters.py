from typing import Any

from sqlalchemy.orm import selectinload

from application.workflows.model import Workflow, WorkflowStep
from graphql_api.helpers import SafeORM, build_load_only, enum_val
from graphql_api.modules.integration.converters import convert_integration
from graphql_api.modules.resource.converters import convert_resource
from graphql_api.modules.secret.converters import convert_secret
from graphql_api.modules.template.converters import convert_template
from graphql_api.modules.user.converters import convert_user
from graphql_api.modules.workflow.types import WorkflowStepType, WorkflowType


def workflow_options(fields: set[str]) -> list[Any]:
    opts: list[Any] = build_load_only(Workflow, fields)
    if "steps" in fields:
        step_load = selectinload(Workflow.steps)
        step_load.selectinload(WorkflowStep.integration_ids)
        step_load.selectinload(WorkflowStep.secret_ids)
        step_load.joinedload(WorkflowStep.template).noload("*")
        step_load.joinedload(WorkflowStep.resource).noload("*")
        opts.append(step_load)
    if "integrationIds" in fields:
        opts.append(selectinload(Workflow.integration_ids))
    if "secretIds" in fields:
        opts.append(selectinload(Workflow.secret_ids))
    return opts


def convert_workflow_step(obj: Any) -> WorkflowStepType:
    return WorkflowStepType(
        id=obj.id,
        workflow_id=obj.workflow_id,
        template_id=obj.template_id,
        template=convert_template(getattr(obj, "template", None)),
        resource_id=obj.resource_id,
        resource=convert_resource(getattr(obj, "resource", None)) if getattr(obj, "resource", None) else None,
        source_code_version_id=obj.source_code_version_id,
        parent_resource_ids=obj.parent_resource_ids,
        integration_ids=[
            x for x in (convert_integration(i) for i in getattr(obj, "integration_ids", []) or []) if x is not None
        ],
        secret_ids=[x for x in (convert_secret(s) for s in getattr(obj, "secret_ids", []) or []) if x is not None],
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
        blueprint_id=obj.blueprint_id,
        wiring_snapshot=obj.wiring_snapshot,
        variable_overrides=obj.variable_overrides,
        parent_overrides=obj.parent_overrides,
        source_code_version_overrides=obj.source_code_version_overrides,
        integration_ids=(
            [x for x in (convert_integration(i) for i in getattr(obj, "integration_ids", []) or []) if x is not None]
            if fields is None or "integrationIds" in fields
            else []
        ),
        secret_ids=(
            [x for x in (convert_secret(s) for s in getattr(obj, "secret_ids", []) or []) if x is not None]
            if fields is None or "secretIds" in fields
            else []
        ),
        storage_id=obj.storage_id,
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
