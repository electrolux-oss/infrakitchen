"""Tests for the plan and apply workflows: WorkflowTask.manage_plan_step,
manage_apply_step and the level-by-level run_resource_steps loop."""

from datetime import datetime
from typing import cast
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.workflows.model import WorkflowStep
from application.workflows.schema import WorkflowResponse
from core.constants.model import ModelActions, ModelState, ModelStatus, WorkflowAction
from core.errors import CannotProceed


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _resource(
    *,
    state: ModelState = ModelState.PROVISIONED,
    status: ModelStatus = ModelStatus.DONE,
    abstract: bool = False,
):
    r = Mock()
    r.id = uuid4()
    r.name = "res"
    r.state = state
    r.status = status
    r.abstract = abstract
    return r


def _step(*, position: int = 0, status: str = ModelStatus.PENDING) -> WorkflowStep:
    return WorkflowStep(
        id=uuid4(),
        workflow_id=uuid4(),
        template_id=uuid4(),
        template=Mock(),
        resource_id=uuid4(),
        resource=None,
        source_code_version_id=None,
        source_code_version=None,
        parent_resource_ids=[],
        integration_ids=[],
        secret_ids=[],
        storage_id=None,
        position=position,
        status=status,
        error_message=None,
        resolved_variables={},
        started_at=None,
        completed_at=None,
    )


def _task(steps: list[WorkflowStep], action: WorkflowAction, *, step_status: str | None = None):
    from application.workflows.task import WorkflowTask

    workflow_id = uuid4()
    workflow_stub = Mock()
    workflow_stub.id = workflow_id
    workflow_stub.action = action
    workflow_stub.status = ModelStatus.PENDING
    workflow_stub.steps = steps
    workflow_stub.started_at = None
    workflow_stub.completed_at = None

    task = WorkflowTask.__new__(WorkflowTask)
    task.session = Mock()
    task.session.commit = AsyncMock()
    task.session.rollback = AsyncMock()
    task.workflow_instance = workflow_stub
    task.workflow_pydantic = WorkflowResponse(
        id=workflow_id, action=action, status=ModelStatus.PENDING, steps=[], created_at=datetime.now()
    )
    task.resource_service = Mock()
    task.resource_service.get_by_id = AsyncMock(return_value=_resource())
    task.resource_service.patch_action = AsyncMock()
    task.event_sender = Mock()
    task.event_sender.send_task = AsyncMock()
    task.logger = Mock()
    task.user = Mock()
    task.action = ModelActions.EXECUTE
    task.step_id = None
    task.step_status = step_status

    async def _change_step_status(step, new_status=None, error_message=None, send_task=False):
        if new_status:
            step.status = new_status
        step.error_message = error_message

    async def _change_entity_status(new_status=None, event_type=None):
        if new_status:
            workflow_stub.status = new_status

    task.change_step_status = _change_step_status  # type: ignore
    task.change_entity_status = AsyncMock(side_effect=_change_entity_status)  # type: ignore
    return task


def _patched_actions(task) -> list[str]:
    return [c[0][1].action for c in cast(AsyncMock, task.resource_service.patch_action).call_args_list]


class TestStepCommitsResourceAuditLog:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("action", [WorkflowAction.PLAN, WorkflowAction.APPLY])
    async def test_step_is_saved_after_the_resource_action(self, action):
        """The resource's audit log is only flushed by patch_action; the step update commits it."""
        step = _step()
        task = _task([step], action)
        calls: list[str] = []
        task.resource_service.patch_action = AsyncMock(side_effect=lambda *a, **k: calls.append("patch_action"))
        change_step_status = task.change_step_status

        async def _record(step, new_status=None, error_message=None, send_task=False):
            calls.append(f"step:{new_status}")
            await change_step_status(step, new_status=new_status, error_message=error_message, send_task=send_task)

        task.change_step_status = _record

        handler = task.manage_plan_step if action == WorkflowAction.PLAN else task.manage_apply_step
        await handler(step)

        assert calls == ["patch_action", f"step:{ModelStatus.IN_PROGRESS}"]


# ---------------------------------------------------------------------------
# Plan steps
# ---------------------------------------------------------------------------


class TestManagePlanStep:
    @pytest.mark.asyncio
    async def test_pending_issues_dryrun_with_trace_id(self):
        step = _step()
        task = _task([step], WorkflowAction.PLAN)

        await task.manage_plan_step(step)

        patch_action = cast(AsyncMock, task.resource_service.patch_action)
        assert patch_action.call_args[0][1].action == ModelActions.DRYRUN
        assert patch_action.call_args.kwargs["trace_id"] == str(task.workflow_pydantic.id)
        assert step.status == ModelStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_abstract_is_done_without_dryrun(self):
        step = _step()
        task = _task([step], WorkflowAction.PLAN)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(abstract=True))

        await task.manage_plan_step(step)

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert step.status == ModelStatus.DONE

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "reported, expected",
        [
            (ModelStatus.DONE, ModelStatus.DONE),
            (ModelStatus.ERROR, ModelStatus.ERROR),
            (None, ModelStatus.ERROR),  # lost worker reports no result
        ],
    )
    async def test_callback_uses_reported_result(self, reported, expected):
        step = _step(status=ModelStatus.IN_PROGRESS)
        task = _task([step], WorkflowAction.PLAN, step_status=reported)

        await task.manage_plan_step(step)

        assert step.status == expected
        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()


# ---------------------------------------------------------------------------
# Apply steps
# ---------------------------------------------------------------------------


class TestManageApplyStep:
    @pytest.mark.asyncio
    async def test_pending_issues_execute(self):
        step = _step()
        task = _task([step], WorkflowAction.APPLY)

        await task.manage_apply_step(step)

        assert _patched_actions(task) == [ModelActions.EXECUTE]
        assert step.status == ModelStatus.IN_PROGRESS

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, status",
        [
            (ModelState.PROVISIONED, ModelStatus.APPROVAL_PENDING),
            (ModelState.PROVISION, ModelStatus.REJECTED),
            (ModelState.DESTROY, ModelStatus.READY),
            (ModelState.PROVISIONED, ModelStatus.QUEUED),
        ],
    )
    async def test_refuses_resources_that_changed_since_creation(self, state, status):
        step = _step()
        task = _task([step], WorkflowAction.APPLY)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(state=state, status=status))

        with pytest.raises(CannotProceed):
            await task.manage_apply_step(step)

        # Never approves or executes
        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()

    @pytest.mark.asyncio
    async def test_callback_done_marks_step_done(self):
        step = _step(status=ModelStatus.IN_PROGRESS)
        task = _task([step], WorkflowAction.APPLY)

        await task.manage_apply_step(step)

        assert step.status == ModelStatus.DONE

    @pytest.mark.asyncio
    async def test_callback_error_raises(self):
        step = _step(status=ModelStatus.IN_PROGRESS)
        task = _task([step], WorkflowAction.APPLY)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(status=ModelStatus.ERROR))

        with pytest.raises(CannotProceed, match="Apply failed"):
            await task.manage_apply_step(step)

    @pytest.mark.asyncio
    async def test_callback_reporting_error_fails_step_even_if_resource_status_is_untouched(self):
        step = _step(status=ModelStatus.IN_PROGRESS)
        task = _task([step], WorkflowAction.APPLY, step_status=ModelStatus.ERROR)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(status=ModelStatus.QUEUED))

        with pytest.raises(CannotProceed, match="Apply failed"):
            await task.manage_apply_step(step)

    @pytest.mark.asyncio
    async def test_late_callback_on_failed_step_does_not_rerun(self):
        step = _step(status=ModelStatus.ERROR)
        task = _task([step], WorkflowAction.APPLY)
        task.step_id = str(step.id)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(status=ModelStatus.ERROR))

        await task.manage_apply_step(step)

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert step.status == ModelStatus.ERROR

    @pytest.mark.asyncio
    async def test_user_rerun_retries_failed_step(self):
        step = _step(status=ModelStatus.ERROR)
        task = _task([step], WorkflowAction.APPLY)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(status=ModelStatus.ERROR))

        await task.manage_apply_step(step)

        assert _patched_actions(task) == [ModelActions.EXECUTE]


# ---------------------------------------------------------------------------
# Level progression
# ---------------------------------------------------------------------------


class TestRunResourceSteps:
    @pytest.mark.asyncio
    async def test_apply_starts_only_first_level(self):
        root, child = _step(position=0), _step(position=1)
        task = _task([root, child], WorkflowAction.APPLY)

        await task.start_pipeline()

        assert root.status == ModelStatus.IN_PROGRESS
        assert child.status == ModelStatus.PENDING

    @pytest.mark.asyncio
    async def test_apply_callback_launches_next_level(self):
        root, child = _step(position=0, status=ModelStatus.IN_PROGRESS), _step(position=1)
        task = _task([root, child], WorkflowAction.APPLY)
        task.step_id = str(root.id)

        await task.start_pipeline()

        assert root.status == ModelStatus.DONE
        assert child.status == ModelStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_apply_failure_stops_workflow(self):
        root, child = _step(position=0, status=ModelStatus.IN_PROGRESS), _step(position=1)
        task = _task([root, child], WorkflowAction.APPLY)
        task.step_id = str(root.id)
        task.resource_service.get_by_id = AsyncMock(return_value=_resource(status=ModelStatus.ERROR))

        await task.start_pipeline()

        assert root.status == ModelStatus.ERROR
        assert child.status == ModelStatus.PENDING
        assert task.workflow_instance.status == ModelStatus.ERROR

    @pytest.mark.asyncio
    async def test_plan_failure_continues_to_next_level(self):
        root, child = _step(position=0, status=ModelStatus.IN_PROGRESS), _step(position=1)
        task = _task([root, child], WorkflowAction.PLAN, step_status=ModelStatus.ERROR)
        task.step_id = str(root.id)

        await task.start_pipeline()

        assert root.status == ModelStatus.ERROR
        assert child.status == ModelStatus.IN_PROGRESS
        assert task.workflow_instance.status == ModelStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_plan_ends_in_error_when_a_step_failed(self):
        root = _step(position=0, status=ModelStatus.ERROR)
        child = _step(position=1, status=ModelStatus.IN_PROGRESS)
        task = _task([root, child], WorkflowAction.PLAN, step_status=ModelStatus.DONE)
        task.step_id = str(child.id)

        await task.start_pipeline()

        assert child.status == ModelStatus.DONE
        assert task.workflow_instance.status == ModelStatus.ERROR

    @pytest.mark.asyncio
    async def test_plan_rerun_retries_failed_steps(self):
        ok, failed = _step(position=0, status=ModelStatus.DONE), _step(position=1, status=ModelStatus.ERROR)
        task = _task([ok, failed], WorkflowAction.PLAN)
        task.workflow_instance.status = ModelStatus.ERROR

        await task.start_pipeline()

        assert ok.status == ModelStatus.DONE
        assert failed.status == ModelStatus.IN_PROGRESS
        assert _patched_actions(task) == [ModelActions.DRYRUN]


class TestRerunFinishedWorkflow:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "action, expected",
        [(WorkflowAction.PLAN, ModelActions.DRYRUN), (WorkflowAction.APPLY, ModelActions.EXECUTE)],
    )
    async def test_done_workflow_runs_every_step_again(self, action, expected):
        root, child = _step(position=0, status=ModelStatus.DONE), _step(position=1, status=ModelStatus.DONE)
        task = _task([root, child], action)
        task.workflow_instance.status = ModelStatus.DONE

        await task.start_pipeline()

        assert root.status == ModelStatus.IN_PROGRESS
        assert child.status == ModelStatus.PENDING
        assert _patched_actions(task) == [expected]
        assert task.workflow_instance.status == ModelStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_late_callback_does_not_restart_done_workflow(self):
        step = _step(status=ModelStatus.DONE)
        task = _task([step], WorkflowAction.APPLY)
        task.workflow_instance.status = ModelStatus.DONE
        task.step_id = str(step.id)

        await task.start_pipeline()

        cast(AsyncMock, task.resource_service.patch_action).assert_not_called()
        assert task.workflow_instance.status == ModelStatus.DONE
