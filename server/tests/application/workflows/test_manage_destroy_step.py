"""Tests for WorkflowTask.manage_destroy_step, focused on the PENDING branch
that handles resources already in DESTROY or DESTROYED state without
re-issuing the DESTROY action.
"""

from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4
from typing import cast

import pytest

from application.workflows.model import WorkflowStep
from application.workflows.schema import WorkflowResponse, WorkflowStepResponse
from core.constants.model import ModelActions, ModelState, ModelStatus, WorkflowAction


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_resource_response(*, state: ModelState, status: ModelStatus):
    r = Mock()
    r.id = uuid4()
    r.state = state
    r.status = status
    return r


def _make_step(*, resource_id=None, status: str = ModelStatus.PENDING) -> WorkflowStep:
    step_id = uuid4()
    step = WorkflowStep(
        id=step_id,
        workflow_id=uuid4(),
        template_id=uuid4(),
        template=Mock(),
        resource_id=resource_id or uuid4(),
        resource=None,
        source_code_version_id=None,
        source_code_version=None,
        parent_resource_ids=[],
        integration_ids=[],
        secret_ids=[],
        storage_id=None,
        position=0,
        status=status,
        error_message=None,
        resolved_variables={},
        started_at=None,
        completed_at=None,
    )
    return step


def _make_task(step: WorkflowStep):
    """Build a minimal WorkflowTask with all dependencies mocked."""
    from application.workflows.task import WorkflowTask

    workflow_id = step.workflow_id

    # Build the pydantic response directly — avoids model_validate on ORM
    # objects that have Mock sub-objects which fail Pydantic validation.
    step_response = WorkflowStepResponse(
        id=step.id,
        template_id=step.template_id,
        resource_id=step.resource_id,
        position=step.position,
        status=step.status,
    )
    workflow_response = WorkflowResponse(
        id=workflow_id,
        action=WorkflowAction.DESTROY,
        status=ModelStatus.PENDING,
        steps=[step_response],
        created_at=datetime.now(),
    )

    # A minimal ORM-ish workflow stub — only attributes WorkflowTask touches
    workflow_stub = Mock()
    workflow_stub.id = workflow_id
    workflow_stub.action = WorkflowAction.DESTROY
    workflow_stub.status = ModelStatus.PENDING
    workflow_stub.steps = [step]
    workflow_stub.started_at = None
    workflow_stub.completed_at = None

    task = WorkflowTask.__new__(WorkflowTask)
    task.session = Mock()
    task.session.commit = AsyncMock()

    task.workflow_instance = workflow_stub
    task.workflow_pydantic = workflow_response

    task.resource_service = Mock()
    task.resource_service.get_by_id = AsyncMock()
    task.resource_service.patch_action = AsyncMock()

    task.workflow_service = Mock()
    task.workflow_service.crud = Mock()
    task.workflow_service.crud.get_by_id = AsyncMock(return_value=workflow_stub)

    task.event_sender = Mock()
    task.event_sender.send_event = AsyncMock()
    task.event_sender.send_task = AsyncMock()

    task.logger = Mock()
    task.user = Mock()
    task.action = ModelActions.EXECUTE
    task.step_id = None

    task.template_service = Mock()
    task.source_code_version_service = Mock()

    # Mock the status-change plumbing — it commits to DB and re-validates the
    # full ORM graph, which is out of scope for these unit tests.
    # We only care that it's called with the right arguments.
    async def _change_step_status(step, new_status=None, error_message=None, send_task=False):
        if new_status:
            step.status = new_status
        step.error_message = error_message
        if send_task:
            await task.event_sender.send_task(
                task.workflow_pydantic.id,
                requester=task.user,
                action=ModelActions.EXECUTE,
                extra_metadata={"step_id": str(step.id)},
            )

    task.change_step_status = _change_step_status  # type: ignore
    task.change_entity_status = AsyncMock()

    return task


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestManageDestroyStepPending:
    """PENDING step — branching based on current resource state."""

    @pytest.mark.asyncio
    async def test_resource_already_destroyed_marks_step_done(self):
        """Resource DESTROYED+DONE: step marked DONE immediately, no patch_action called."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.DESTROYED, status=ModelStatus.DONE)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        await task.manage_destroy_step(step)

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert step.status == ModelStatus.DONE
        assert step.completed_at is not None

    @pytest.mark.asyncio
    async def test_resource_in_destroy_ready_skips_destroy_call(self):
        """Resource DESTROY+READY: step set to READY, send_task=True, no patch_action."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.READY)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        await task.manage_destroy_step(step)

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert step.status == ModelStatus.READY
        cast(AsyncMock, task.event_sender.send_task).assert_awaited_once()

    @pytest.mark.asyncio
    async def test_resource_in_destroy_approval_pending_skips_destroy_call(self):
        """Resource DESTROY+APPROVAL_PENDING: step set to APPROVAL_PENDING, send_task=True."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.APPROVAL_PENDING)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        await task.manage_destroy_step(step)

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert step.status == ModelStatus.APPROVAL_PENDING
        cast(AsyncMock, task.event_sender.send_task).assert_awaited_once()

    @pytest.mark.asyncio
    async def test_resource_in_destroy_in_progress_skips_destroy_call(self):
        """Resource DESTROY+IN_PROGRESS: step set to IN_PROGRESS, no send_task."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.IN_PROGRESS)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        await task.manage_destroy_step(step)

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert step.status == ModelStatus.IN_PROGRESS
        cast(AsyncMock, task.event_sender.send_task).assert_not_called()

    @pytest.mark.asyncio
    async def test_resource_provisioned_calls_destroy_action(self):
        """Normal path: resource PROVISIONED+DONE → patch_action(DESTROY) called."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.PROVISIONED, status=ModelStatus.DONE)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        after_destroy = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.READY)
        cast(AsyncMock, task.resource_service.patch_action).return_value = after_destroy

        await task.manage_destroy_step(step)

        patch_action = cast(AsyncMock, task.resource_service.patch_action)
        patch_action.assert_awaited_once()
        assert patch_action.call_args[0][1].action == ModelActions.DESTROY

    @pytest.mark.asyncio
    async def test_resource_provision_error_calls_destroy_action(self):
        """Resource PROVISION+ERROR → patch_action(DESTROY) called (normal path)."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.PROVISION, status=ModelStatus.ERROR)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        after_destroy = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.APPROVAL_PENDING)
        cast(AsyncMock, task.resource_service.patch_action).return_value = after_destroy

        await task.manage_destroy_step(step)

        patch_action = cast(AsyncMock, task.resource_service.patch_action)
        patch_action.assert_awaited_once()
        assert patch_action.call_args[0][1].action == ModelActions.DESTROY
        # Approval pending triggers send_task
        cast(AsyncMock, task.event_sender.send_task).assert_awaited_once()

    @pytest.mark.asyncio
    async def test_resource_destroy_error_calls_execute_action(self):
        """Resource DESTROY+ERROR: patch_action(EXECUTE) called to retry, not DESTROY."""
        step = _make_step()
        task = _make_task(step)

        resource = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.ERROR)
        cast(AsyncMock, task.resource_service.get_by_id).return_value = resource

        after_execute = _make_resource_response(state=ModelState.DESTROY, status=ModelStatus.IN_PROGRESS)
        cast(AsyncMock, task.resource_service.patch_action).return_value = after_execute

        await task.manage_destroy_step(step)

        patch_action = cast(AsyncMock, task.resource_service.patch_action)
        patch_action.assert_awaited_once()
        assert patch_action.call_args[0][1].action == ModelActions.EXECUTE
        # IN_PROGRESS does not trigger send_task
        cast(AsyncMock, task.event_sender.send_task).assert_not_called()
        assert step.status == ModelStatus.IN_PROGRESS
