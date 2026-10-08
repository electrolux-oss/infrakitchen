"""Tests for WorkflowTask._resolve_wired_variables."""

from datetime import datetime
from unittest.mock import AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from application.workflows.schema import WiringRule, WorkflowResponse, WorkflowStepResponse
from core.constants.model import ModelStatus, WorkflowAction


def _make_workflow(source_step: WorkflowStepResponse, target_step: WorkflowStepResponse, wiring: list[WiringRule]):
    return WorkflowResponse(
        id=uuid4(),
        action=WorkflowAction.CREATE,
        status=ModelStatus.IN_PROGRESS,
        steps=[source_step, target_step],
        wiring_snapshot=wiring,
        created_at=datetime.now(),
    )


@pytest.mark.asyncio
async def test_resolves_outputs_of_step_completed_in_same_task():
    """
    The upstream step is completed by the task that then launches the downstream step,
    so the snapshot taken at task start still has the upstream step in progress.
    """
    from application.workflows.task import WorkflowTask

    source_template_id, target_template_id, resource_id = uuid4(), uuid4(), uuid4()
    wiring = [
        WiringRule(
            source_template_id=source_template_id,
            source_output="vpc_id",
            target_template_id=target_template_id,
            target_variable="vpc_id",
        )
    ]
    target_step = WorkflowStepResponse(
        id=uuid4(), template_id=target_template_id, position=1, status=ModelStatus.PENDING
    )
    source_step_id = uuid4()

    task = WorkflowTask.__new__(WorkflowTask)
    task.workflow_pydantic = _make_workflow(
        WorkflowStepResponse(
            id=source_step_id,
            template_id=source_template_id,
            resource_id=resource_id,
            position=0,
            status=ModelStatus.IN_PROGRESS,
        ),
        target_step,
        wiring,
    )
    task.workflow_instance = _make_workflow(  # type: ignore[assignment]
        WorkflowStepResponse(
            id=source_step_id,
            template_id=source_template_id,
            resource_id=resource_id,
            position=0,
            status=ModelStatus.DONE,
        ),
        target_step,
        wiring,
    )
    output = Mock()
    output.name = "vpc_id"
    output.value = "vpc-123"
    task.resource_service = Mock()
    task.resource_service.get_by_id = AsyncMock(return_value=Mock(outputs=[output]))
    task.logger = Mock()

    wired_vars, wired_config = await task._resolve_wired_variables(Mock(template_id=target_template_id))

    assert wired_vars == {"vpc_id": "vpc-123"}
    assert wired_config == {}
    task.resource_service.get_by_id.assert_awaited_once_with(resource_id)


def _entry(name, value):
    entry = Mock()
    entry.name = name
    entry.value = value
    return entry


def _task(workflow: WorkflowResponse, resources: dict):
    from application.workflows.task import WorkflowTask

    task = WorkflowTask.__new__(WorkflowTask)
    task.workflow_pydantic = workflow
    task.workflow_instance = workflow  # type: ignore[assignment]
    task.resource_service = Mock()
    task.resource_service.get_by_id = AsyncMock(side_effect=lambda rid: resources.get(rid))
    task.logger = Mock()
    return task


@pytest.mark.asyncio
async def test_dependency_config_of_step_resource_feeds_variable_and_output_feeds_config():
    service_tid, target_tid, service_rid = uuid4(), uuid4(), uuid4()
    wiring = [
        WiringRule(
            source_template_id=service_tid,
            source_output="service_name",
            source_type="dependency_config",
            target_template_id=target_tid,
            target_variable="service_account_name",
        ),
        WiringRule(
            source_template_id=service_tid,
            source_output="team",
            target_template_id=target_tid,
            target_variable="owner",
            target_type="dependency_config",
        ),
    ]
    workflow = _make_workflow(
        WorkflowStepResponse(
            id=uuid4(), template_id=service_tid, resource_id=service_rid, position=0, status=ModelStatus.DONE
        ),
        WorkflowStepResponse(id=uuid4(), template_id=target_tid, position=1, status=ModelStatus.PENDING),
        wiring,
    )
    service = Mock(dependency_config=[_entry("service_name", "checkout")], outputs=[_entry("team", "payments")])
    task = _task(workflow, {service_rid: service})

    wired_vars, wired_config = await task._resolve_wired_variables(Mock(template_id=target_tid))

    assert wired_vars == {"service_account_name": "checkout"}
    assert wired_config == {"owner": "payments"}


@pytest.mark.asyncio
async def test_external_template_source_is_read_from_selected_parent_resource():
    """Templates outside the workflow are parents selected by the user, read from that resource."""
    from application.workflows.task import WorkflowTask

    external_tid, target_tid, external_rid = uuid4(), uuid4(), uuid4()
    wiring = [
        WiringRule(
            source_template_id=external_tid,
            source_output="service_name",
            source_type="dependency_config",
            target_template_id=target_tid,
            target_variable="name",
        ),
        WiringRule(
            source_template_id=external_tid,
            source_output="endpoint",
            target_template_id=target_tid,
            target_variable="endpoint",
        ),
    ]
    target_step = WorkflowStepResponse(id=uuid4(), template_id=target_tid, position=0, status=ModelStatus.PENDING)

    task = WorkflowTask.__new__(WorkflowTask)
    workflow = WorkflowResponse(
        id=uuid4(),
        action=WorkflowAction.CREATE,
        status=ModelStatus.IN_PROGRESS,
        steps=[target_step],
        wiring_snapshot=wiring,
        created_at=datetime.now(),
    )
    task.workflow_pydantic = workflow
    # the ORM workflow holds the parent resources selected for the steps
    selected_parent = Mock(id=external_rid, template_id=external_tid)
    task.workflow_instance = Mock(steps=[Mock(parent_resource_ids=[selected_parent])])
    external = Mock(dependency_config=[_entry("service_name", "checkout")], outputs=[_entry("endpoint", "db:5432")])
    task.resource_service = Mock()
    task.resource_service.get_by_id = AsyncMock(return_value=external)
    task.logger = Mock()

    with patch("application.workflows.task.WorkflowResponse.model_validate", return_value=workflow):
        wired_vars, wired_config = await task._resolve_wired_variables(Mock(template_id=target_tid))

    assert wired_vars == {"name": "checkout", "endpoint": "db:5432"}
    assert wired_config == {}
    task.resource_service.get_by_id.assert_awaited_with(external_rid)


def test_wiring_rule_without_types_keeps_output_to_variable():
    """Wires stored before the endpoint types existed."""
    rule = WiringRule.model_validate(
        {
            "source_template_id": str(uuid4()),
            "source_output": "vpc_id",
            "target_template_id": str(uuid4()),
            "target_variable": "vpc_id",
        }
    )

    assert (rule.source_type, rule.target_type) == ("output", "variable")
