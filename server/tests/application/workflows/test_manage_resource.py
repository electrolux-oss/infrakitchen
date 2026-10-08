"""Tests for WorkflowTask.manage_resource creating the resource of a step."""

from typing import Any, cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from core.constants.model import ModelStatus


def _make_task(steps):
    from application.workflows.task import WorkflowTask

    task = WorkflowTask.__new__(WorkflowTask)
    task.workflow_instance = Mock(steps=steps)
    task.template_service = Mock()
    task.resource_service = Mock()
    task.resource_service.create = AsyncMock(return_value=Mock(id=uuid4()))
    task.logger = Mock()
    task.user = Mock()
    task._resolve_wired_variables = AsyncMock(return_value=({}, {}))  # type: ignore[method-assign]
    task.change_step_status = AsyncMock()  # type: ignore[method-assign]
    return task


def _created_resource(task: Any):
    """The ResourceCreate the step passed to the resource service."""
    create_call = cast(AsyncMock, task.resource_service.create).await_args
    assert create_call is not None
    return create_call.kwargs["resource"]


def _make_step(template_id, resource_id=None, parent_resources=None):
    return Mock(
        id=uuid4(),
        template_id=template_id,
        resource_id=resource_id,
        status=ModelStatus.PENDING,
        parent_resource_ids=parent_resources or [],
        integration_ids=[],
        secret_ids=[],
        storage_id=uuid4(),
        source_code_version_id=uuid4(),
        resolved_variables={},
        resolved_dependency_config={},
    )


@pytest.mark.asyncio
async def test_combines_selected_parents_with_parents_created_by_earlier_steps():
    external_template_id, upstream_template_id, template_id = uuid4(), uuid4(), uuid4()
    external_parent = Mock(id=uuid4(), template_id=external_template_id)
    upstream_step = _make_step(upstream_template_id, resource_id=uuid4())
    step = _make_step(template_id, parent_resources=[external_parent])

    task = _make_task([upstream_step, step])
    task.template_service.get_by_id = AsyncMock(
        return_value=Mock(
            id=template_id,
            template="credentials",
            abstract=False,
            configuration=Mock(naming_convention="credentials-{name}"),
            parents=[Mock(id=external_template_id), Mock(id=upstream_template_id)],
        )
    )

    await task.manage_resource(step)

    resource = _created_resource(task)
    assert resource.parents == [external_parent.id, upstream_step.resource_id]


@pytest.mark.asyncio
async def test_selected_parent_takes_precedence_over_step_of_same_template():
    parent_template_id, template_id = uuid4(), uuid4()
    selected_parent = Mock(id=uuid4(), template_id=parent_template_id)
    upstream_step = _make_step(parent_template_id, resource_id=uuid4())
    step = _make_step(template_id, parent_resources=[selected_parent])

    task = _make_task([upstream_step, step])
    task.template_service.get_by_id = AsyncMock(
        return_value=Mock(
            id=template_id,
            template="child",
            abstract=False,
            configuration=Mock(naming_convention="child-{name}"),
            parents=[Mock(id=parent_template_id)],
        )
    )

    await task.manage_resource(step)

    resource = _created_resource(task)
    assert resource.parents == [selected_parent.id]


@pytest.mark.asyncio
async def test_abstract_step_is_created_with_dependency_config_and_without_state(monkeypatch):
    # steps are mocks, not ORM instances
    monkeypatch.setattr("application.workflows.task.flag_modified", Mock())
    template_id = uuid4()
    step = _make_step(template_id)
    step.resolved_dependency_config = {"service_name": "checkout"}

    task = _make_task([step])
    task._resolve_wired_variables = AsyncMock(return_value=({}, {"owner_team": 42}))  # type: ignore[method-assign]
    task.template_service.get_by_id = AsyncMock(
        return_value=Mock(
            id=template_id,
            template="service",
            abstract=True,
            configuration=Mock(naming_convention="service-{service_name}"),
            parents=[],
        )
    )

    await task.manage_resource(step)

    resource = _created_resource(task)
    assert {c.name: c.value for c in resource.dependency_config} == {"service_name": "checkout", "owner_team": "42"}
    assert all(c.inherited_by_children for c in resource.dependency_config)
    assert resource.storage_id is None
    assert resource.storage_path is None
