from uuid import uuid4

import pytest

from application.executors.functions import resolve_run_ref
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import AccessDenied

PERMISSIONS_PATH = "application.executors.functions.user_entity_permissions"


@pytest.fixture
def branch_executor(mocked_executor):
    """An executor pinned to branch main of a source code with branches main/dev and tags v1.0/v1.1."""
    mocked_executor.id = uuid4()
    mocked_executor.source_code_branch = "main"
    mocked_executor.source_code_version = None
    mocked_executor.state = ModelState.PROVISIONED
    mocked_executor.status = ModelStatus.DONE
    return mocked_executor


class TestResolveRunRef:
    def test_no_ref(self, branch_executor):
        assert resolve_run_ref(branch_executor, None, None) is None

    def test_configured_ref_is_a_normal_run(self, branch_executor):
        assert resolve_run_ref(branch_executor, "main", None) is None

    def test_other_branch(self, branch_executor):
        assert resolve_run_ref(branch_executor, "dev", None) == ("dev", "branch")

    def test_tag(self, branch_executor):
        assert resolve_run_ref(branch_executor, None, "v1.1") == ("v1.1", "tag")

    def test_unknown_branch(self, branch_executor):
        with pytest.raises(ValueError, match="Branch feature not found"):
            _ = resolve_run_ref(branch_executor, "feature", None)

    def test_unknown_tag(self, branch_executor):
        with pytest.raises(ValueError, match="Tag v9 not found"):
            _ = resolve_run_ref(branch_executor, None, "v9")

    def test_both_set(self, branch_executor):
        with pytest.raises(ValueError, match="Only one of"):
            _ = resolve_run_ref(branch_executor, "dev", "v1.1")


class TestPatchActionWithRef:
    @pytest.mark.asyncio
    async def test_admin_executes_other_branch(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mock_user_permissions,
        monkeypatch,
        mocked_user,
        branch_executor,
    ):
        mock_user_permissions(["admin"], monkeypatch, PERMISSIONS_PATH)
        mock_executor_crud.get_by_id.return_value = branch_executor

        _ = await mock_executor_service.patch_action_executor(
            executor_id=branch_executor.id,
            body=PatchBodyModel(action=ModelActions.EXECUTE),
            requester=mocked_user,
            source_code_branch="dev",
        )

        metadata = {"source_code_ref": "dev", "source_code_ref_type": "branch"}
        assert mock_audit_log_handler.create_log.await_args.kwargs["action_metadata"] == metadata
        assert mock_event_sender.send_task.await_args.kwargs["extra_metadata"] == metadata
        # the configured ref is not changed by the run
        assert branch_executor.source_code_branch == "main"

    @pytest.mark.asyncio
    async def test_writer_cannot_execute_other_branch(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_event_sender,
        mock_user_permissions,
        monkeypatch,
        mocked_user,
        branch_executor,
    ):
        mock_user_permissions(["write"], monkeypatch, PERMISSIONS_PATH)
        mock_executor_crud.get_by_id.return_value = branch_executor

        with pytest.raises(AccessDenied, match="Only executor admins"):
            _ = await mock_executor_service.patch_action_executor(
                executor_id=branch_executor.id,
                body=PatchBodyModel(action=ModelActions.EXECUTE),
                requester=mocked_user,
                source_code_version="v1.1",
            )

        mock_event_sender.send_task.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_writer_executes_configured_branch(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_event_sender,
        mock_user_permissions,
        monkeypatch,
        mocked_user,
        branch_executor,
    ):
        mock_user_permissions(["write"], monkeypatch, PERMISSIONS_PATH)
        mock_executor_crud.get_by_id.return_value = branch_executor

        _ = await mock_executor_service.patch_action_executor(
            executor_id=branch_executor.id,
            body=PatchBodyModel(action=ModelActions.EXECUTE),
            requester=mocked_user,
            source_code_branch="main",
        )

        assert "extra_metadata" not in mock_event_sender.send_task.await_args.kwargs

    @pytest.mark.asyncio
    async def test_writer_cannot_dry_run_other_tag(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_event_sender,
        mock_user_permissions,
        monkeypatch,
        mocked_user,
        branch_executor,
    ):
        mock_user_permissions(["write"], monkeypatch, PERMISSIONS_PATH)
        mock_executor_crud.get_by_id.return_value = branch_executor

        with pytest.raises(AccessDenied, match="Only executor admins"):
            _ = await mock_executor_service.patch_action_executor(
                executor_id=branch_executor.id,
                body=PatchBodyModel(action=ModelActions.DRYRUN),
                requester=mocked_user,
                source_code_version="v1.1",
            )

        mock_event_sender.send_task.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_admin_dry_runs_other_tag(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_event_sender,
        mock_user_permissions,
        monkeypatch,
        mocked_user,
        branch_executor,
    ):
        mock_user_permissions(["admin"], monkeypatch, PERMISSIONS_PATH)
        mock_executor_crud.get_by_id.return_value = branch_executor

        _ = await mock_executor_service.patch_action_executor(
            executor_id=branch_executor.id,
            body=PatchBodyModel(action=ModelActions.DRYRUN),
            requester=mocked_user,
            source_code_version="v1.1",
        )

        assert mock_event_sender.send_task.await_args.kwargs["extra_metadata"] == {
            "source_code_ref": "v1.1",
            "source_code_ref_type": "tag",
        }

    @pytest.mark.asyncio
    @pytest.mark.parametrize("action", [ModelActions.DESTROY, ModelActions.RECREATE, ModelActions.RETRY])
    async def test_other_actions_reject_ref(
        self, action, mock_executor_service, mock_executor_crud, mock_event_sender, mocked_user, branch_executor
    ):
        mock_executor_crud.get_by_id.return_value = branch_executor

        with pytest.raises(ValueError, match="can only be used to execute or dry run"):
            _ = await mock_executor_service.patch_action_executor(
                executor_id=branch_executor.id,
                body=PatchBodyModel(action=action),
                requester=mocked_user,
                source_code_branch="dev",
            )

        mock_event_sender.send_task.assert_not_awaited()


class TestRetryKeepsRef:
    @pytest.mark.asyncio
    async def test_retry_runs_last_execute_ref(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_user,
        branch_executor,
    ):
        branch_executor.status = ModelStatus.QUEUED
        mock_executor_crud.get_by_id.return_value = branch_executor
        # an execute row also carries the execution result merged in by the worker
        mock_audit_log_handler.get_last_action_metadata.return_value = {
            "source_code_ref": "dev",
            "source_code_ref_type": "branch",
            "execution": {"status": "failed"},
        }

        _ = await mock_executor_service.patch_action_executor(
            executor_id=branch_executor.id, body=PatchBodyModel(action=ModelActions.RETRY), requester=mocked_user
        )

        metadata = {"source_code_ref": "dev", "source_code_ref_type": "branch"}
        mock_audit_log_handler.get_last_action_metadata.assert_awaited_once_with(
            branch_executor.id, [ModelActions.EXECUTE, ModelActions.RETRY]
        )
        assert mock_audit_log_handler.create_log.await_args.kwargs["action_metadata"] == metadata
        assert mock_event_sender.send_task.await_args.kwargs["extra_metadata"] == metadata
        assert mock_event_sender.send_task.await_args.kwargs["action"] == ModelActions.EXECUTE

    @pytest.mark.asyncio
    @pytest.mark.parametrize("last_metadata", [None, {}, {"execution": {"status": "failed"}}])
    async def test_retry_of_configured_ref_run(
        self,
        last_metadata,
        mock_executor_service,
        mock_executor_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_user,
        branch_executor,
    ):
        branch_executor.status = ModelStatus.QUEUED
        mock_executor_crud.get_by_id.return_value = branch_executor
        mock_audit_log_handler.get_last_action_metadata.return_value = last_metadata

        _ = await mock_executor_service.patch_action_executor(
            executor_id=branch_executor.id, body=PatchBodyModel(action=ModelActions.RETRY), requester=mocked_user
        )

        assert "action_metadata" not in mock_audit_log_handler.create_log.await_args.kwargs
        assert "extra_metadata" not in mock_event_sender.send_task.await_args.kwargs
