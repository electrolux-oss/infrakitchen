import pytest
from uuid import uuid4

from application.workflows.model import Workflow
from application.workflows.schema import WorkflowStepUpdate, WorkflowUpdate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core import UserDTO

WORKFLOW_ID = str(uuid4())


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_workflow_service, mock_workflow_crud):
        mock_workflow_crud.get_by_id.return_value = None

        result = await mock_workflow_service.get_by_id("invalid_id")

        assert result is None
        mock_workflow_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, mock_workflow_service, mock_workflow_crud, mocked_workflow):
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        result = await mock_workflow_service.get_by_id(str(mocked_workflow.id))

        assert result is not None
        assert result.id == mocked_workflow.id
        assert result.status == mocked_workflow.status
        assert result._entity_name == "workflow"
        mock_workflow_crud.get_by_id.assert_awaited_once_with(str(mocked_workflow.id))

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_workflow_service, mock_workflow_crud):
        error = RuntimeError("db failure")
        mock_workflow_crud.get_by_id.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.get_by_id(WORKFLOW_ID)

        assert exc.value is error
        mock_workflow_crud.get_by_id.assert_awaited_once_with(WORKFLOW_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_workflow_service, mock_workflow_crud):
        mock_workflow_crud.get_all.return_value = []

        result = await mock_workflow_service.get_all(limit=10)

        assert result == []
        mock_workflow_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_workflow_service, mock_workflow_crud, mocked_workflow):
        workflow2 = Workflow(
            id=uuid4(),
            action="create",
            wiring_snapshot=[],
            status="pending",
            created_by=mocked_workflow.created_by,
            creator=mocked_workflow.creator,
            steps=[],
            created_at=mocked_workflow.created_at,
        )
        mock_workflow_crud.get_all.return_value = [mocked_workflow, workflow2]

        result = await mock_workflow_service.get_all(limit=10, offset=0)

        assert len(result) == 2
        assert result[0].id == mocked_workflow.id
        assert result[1].id == workflow2.id
        mock_workflow_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_workflow_service, mock_workflow_crud):
        error = RuntimeError("db failure")
        mock_workflow_crud.get_all.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.get_all(limit=10)

        assert exc.value is error
        mock_workflow_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_workflow_service, mock_workflow_crud):
        mock_workflow_crud.count.return_value = 5

        result = await mock_workflow_service.count(filter={"status": "pending"})

        assert result == 5
        mock_workflow_crud.count.assert_awaited_once_with(filter={"status": "pending"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_workflow_service, mock_workflow_crud):
        error = RuntimeError("db failure")
        mock_workflow_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.count(filter={"status": "pending"})

        assert exc.value is error
        mock_workflow_crud.count.assert_awaited_once_with(filter={"status": "pending"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_workflow_service,
        mock_workflow_crud,
        mock_audit_log_handler,
        mocked_workflow,
        mocked_user,
    ):
        body = {
            "wiring_snapshot": [],
            "status": "pending",
            "created_by": str(mocked_user.id),
            "steps": [],
        }
        mock_workflow_crud.create.return_value = mocked_workflow

        user_dto = UserDTO.model_validate(mocked_user)
        result = await mock_workflow_service.create(body, user_dto)

        assert result.id == mocked_workflow.id
        assert result.status == mocked_workflow.status
        mock_workflow_crud.create.assert_awaited_once_with(body)
        mock_audit_log_handler.create_log.assert_awaited_once_with(mocked_workflow.id, user_dto.id, ModelActions.CREATE)

    @pytest.mark.asyncio
    async def test_create_with_steps(
        self,
        mock_workflow_service,
        mock_workflow_crud,
        mock_audit_log_handler,
        mocked_workflow,
        mocked_user,
    ):
        template_id = uuid4()
        body = {
            "wiring_snapshot": [],
            "variable_overrides": {},
            "status": "pending",
            "created_by": str(mocked_user.id),
            "steps": [
                {
                    "template_id": str(template_id),
                    "position": 0,
                    "status": "pending",
                    "resolved_variables": {"key": "value"},
                    "parent_resource_ids": [],
                    "integration_ids": [],
                    "secret_ids": [],
                }
            ],
        }
        mock_workflow_crud.create.return_value = mocked_workflow

        user_dto = UserDTO.model_validate(mocked_user)
        result = await mock_workflow_service.create(body, user_dto)

        assert result.id == mocked_workflow.id
        assert len(result.steps) == 1
        mock_workflow_crud.create.assert_awaited_once_with(body)

    @pytest.mark.asyncio
    async def test_create_error(self, mock_workflow_service, mock_workflow_crud, mocked_user):
        body = {"status": "pending", "created_by": str(mocked_user.id), "steps": []}
        error = RuntimeError("create fail")
        mock_workflow_crud.create.side_effect = error

        user_dto = UserDTO.model_validate(mocked_user)
        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.create(body, user_dto)

        assert exc.value is error
        mock_workflow_crud.create.assert_awaited_once()


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_workflow_service,
        mock_workflow_crud,
        mock_audit_log_handler,
        mock_user_dto,
    ):
        workflow_id = uuid4()
        mock_workflow_crud.delete.return_value = None

        await mock_workflow_service.delete(workflow_id, mock_user_dto)

        mock_workflow_crud.delete.assert_awaited_once_with(workflow_id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(workflow_id, mock_user_dto.id, ModelActions.DELETE)

    @pytest.mark.asyncio
    async def test_delete_error(self, mock_workflow_service, mock_workflow_crud, mock_user_dto):
        workflow_id = uuid4()
        error = RuntimeError("delete fail")
        mock_workflow_crud.delete.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.delete(workflow_id, mock_user_dto)

        assert exc.value is error
        mock_workflow_crud.delete.assert_awaited_once_with(workflow_id)


class TestPatchAction:
    @pytest.mark.asyncio
    async def test_patch_execute_success(
        self,
        mock_workflow_service,
        mock_workflow_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_workflow,
        mock_user_dto,
    ):
        patch_body = PatchBodyModel(action=ModelActions.EXECUTE)
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        result = await mock_workflow_service.patch_action(
            workflow_id=mocked_workflow.id, body=patch_body, requester=mock_user_dto
        )

        assert result.id == mocked_workflow.id
        mock_workflow_crud.get_by_id.assert_awaited_once_with(mocked_workflow.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_workflow.id, mock_user_dto.id, ModelActions.EXECUTE
        )
        mock_event_sender.send_task.assert_awaited_once_with(
            mocked_workflow.id,
            requester=mock_user_dto,
            action=ModelActions.EXECUTE,
        )

    @pytest.mark.asyncio
    async def test_patch_not_found(self, mock_workflow_service, mock_workflow_crud, mock_user_dto):
        patch_body = PatchBodyModel(action=ModelActions.EXECUTE)
        mock_workflow_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Execution not found"):
            await mock_workflow_service.patch_action(workflow_id=WORKFLOW_ID, body=patch_body, requester=mock_user_dto)

    @pytest.mark.asyncio
    async def test_patch_unsupported_action(
        self, mock_workflow_service, mock_workflow_crud, mocked_workflow, mock_user_dto
    ):
        patch_body = PatchBodyModel(action="unsupported_action")
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        with pytest.raises(ValueError, match="Action unsupported_action is not supported"):
            await mock_workflow_service.patch_action(
                workflow_id=mocked_workflow.id, body=patch_body, requester=mock_user_dto
            )


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(self, mock_workflow_service, mock_workflow_crud, mocked_workflow):
        update_data = {"status": "in_progress"}
        mocked_workflow.status = "in_progress"
        mock_workflow_crud.update.return_value = mocked_workflow

        result = await mock_workflow_service.update(mocked_workflow.id, update_data)

        assert result.id == mocked_workflow.id
        assert result.status == "in_progress"
        mock_workflow_crud.update.assert_awaited_once_with(mocked_workflow.id, update_data)

    @pytest.mark.asyncio
    async def test_update_not_found(self, mock_workflow_service, mock_workflow_crud):
        workflow_id = uuid4()
        mock_workflow_crud.update.return_value = None

        with pytest.raises(EntityNotFound, match="Execution not found"):
            await mock_workflow_service.update(workflow_id, {"status": "done"})

        mock_workflow_crud.update.assert_awaited_once_with(workflow_id, {"status": "done"})

    @pytest.mark.asyncio
    async def test_update_error(self, mock_workflow_service, mock_workflow_crud):
        workflow_id = uuid4()
        error = RuntimeError("update fail")
        mock_workflow_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.update(workflow_id, {"status": "done"})

        assert exc.value is error


class TestUpdateStep:
    @pytest.mark.asyncio
    async def test_update_step_success(self, mock_workflow_service, mock_workflow_crud, mocked_workflow_step):
        mocked_workflow_step.status = "done"
        mock_workflow_crud.update_step.return_value = mocked_workflow_step

        result = await mock_workflow_service.update_step(mocked_workflow_step.id, {"status": "done"})

        assert result.id == mocked_workflow_step.id
        assert result.status == "done"
        mock_workflow_crud.update_step.assert_awaited_once_with(mocked_workflow_step.id, {"status": "done"})

    @pytest.mark.asyncio
    async def test_update_step_not_found(self, mock_workflow_service, mock_workflow_crud):
        step_id = uuid4()
        mock_workflow_crud.update_step.return_value = None

        with pytest.raises(EntityNotFound, match="Execution step not found"):
            await mock_workflow_service.update_step(step_id, {"status": "done"})

        mock_workflow_crud.update_step.assert_awaited_once_with(step_id, {"status": "done"})

    @pytest.mark.asyncio
    async def test_update_step_error(self, mock_workflow_service, mock_workflow_crud):
        step_id = uuid4()
        error = RuntimeError("update step fail")
        mock_workflow_crud.update_step.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workflow_service.update_step(step_id, {"status": "done"})

        assert exc.value is error


class TestGetWorkflowActions:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "user_permissions,expected_actions",
        [
            (None, []),
            ({}, []),
            ({"api:workflow": "read"}, []),
            ({"api:workflow": "write"}, [ModelActions.EXECUTE, ModelActions.EDIT]),
            (
                {"api:workflow": "admin"},
                [ModelActions.EXECUTE, ModelActions.EDIT, ModelActions.DELETE],
            ),
        ],
    )
    async def test_get_workflow_actions(
        self,
        user_permissions,
        expected_actions,
        mock_workflow_service,
        mock_workflow_crud,
        mocked_workflow,
        mock_user_dto,
        mock_user_permissions,
        monkeypatch,
    ):
        mock_user_permissions(
            user_permissions,
            monkeypatch,
            "application.workflows.service.user_api_permission",
        )
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        result = await mock_workflow_service.get_workflow_actions(str(mocked_workflow.id), mock_user_dto)

        assert sorted(result) == sorted(expected_actions)

    @pytest.mark.asyncio
    async def test_get_workflow_actions_not_found(
        self,
        mock_workflow_service,
        mock_workflow_crud,
        mock_user_dto,
        mock_user_permissions,
        monkeypatch,
    ):
        mock_user_permissions(
            {"api:workflow": "admin"},
            monkeypatch,
            "application.workflows.service.user_api_permission",
        )
        mock_workflow_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Workflow not found"):
            await mock_workflow_service.get_workflow_actions(WORKFLOW_ID, mock_user_dto)


class TestUpdateWithSteps:
    @pytest.mark.asyncio
    async def test_update_with_steps_not_found(self, mock_workflow_service, mock_workflow_crud, mock_user_dto):
        mock_workflow_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Workflow not found"):
            await mock_workflow_service.update_with_steps(WORKFLOW_ID, WorkflowUpdate(), mock_user_dto)

    @pytest.mark.asyncio
    async def test_update_with_steps_wrong_state(
        self, mock_workflow_service, mock_workflow_crud, mocked_workflow, mock_user_dto
    ):
        mocked_workflow.status = ModelStatus.IN_PROGRESS
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        with pytest.raises(EntityWrongState, match="cannot be edited"):
            await mock_workflow_service.update_with_steps(mocked_workflow.id, WorkflowUpdate(), mock_user_dto)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("status", [ModelStatus.PENDING, ModelStatus.ERROR])
    async def test_update_with_steps_allowed_statuses(
        self,
        status,
        mock_workflow_service,
        mock_workflow_crud,
        mocked_workflow,
        mock_user_dto,
    ):
        mocked_workflow.status = status
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        result = await mock_workflow_service.update_with_steps(mocked_workflow.id, WorkflowUpdate(), mock_user_dto)

        assert result.id == mocked_workflow.id

    @pytest.mark.asyncio
    async def test_update_with_steps_unknown_step_raises(
        self, mock_workflow_service, mock_workflow_crud, mocked_workflow, mock_user_dto
    ):
        mocked_workflow.status = ModelStatus.PENDING
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        request = WorkflowUpdate(steps=[WorkflowStepUpdate(id=uuid4(), resolved_variables={"x": 1})])

        with pytest.raises(EntityNotFound, match="does not belong"):
            await mock_workflow_service.update_with_steps(mocked_workflow.id, request, mock_user_dto)

    @pytest.mark.asyncio
    async def test_update_with_steps_success(
        self,
        mock_workflow_service,
        mock_workflow_crud,
        mocked_workflow,
        mocked_workflow_step,
        mock_user_dto,
    ):
        mocked_workflow.status = ModelStatus.PENDING
        mock_workflow_crud.get_by_id.return_value = mocked_workflow

        request = WorkflowUpdate(
            steps=[
                WorkflowStepUpdate(
                    id=mocked_workflow_step.id,
                    resolved_variables={"region": "eu-west-1"},
                )
            ],
        )

        result = await mock_workflow_service.update_with_steps(mocked_workflow.id, request, mock_user_dto)

        assert result.id == mocked_workflow.id
        mock_workflow_crud.update_step.assert_awaited_once()
        args, _ = mock_workflow_crud.update_step.call_args
        assert args[0] == mocked_workflow_step.id
        assert args[1] == {"resolved_variables": {"region": "eu-west-1"}}
