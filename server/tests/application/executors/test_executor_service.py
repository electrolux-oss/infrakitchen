from unittest.mock import AsyncMock, Mock
from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from pydantic.errors import PydanticUserError

from application.executors.model import Executor
from application.executors.schema import (
    ExecutorResponse,
    ExecutorCreate,
)
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.users.model import UserDTO

EXECUTOR_ID = "abc123"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_executor_service):
        mock_executor_service.crud.get_by_id.return_value = None

        with pytest.raises(ValueError) as exc:
            await mock_executor_service.get_by_id("invalid_id")
        assert str(exc.value) == "Invalid executor ID: invalid_id"

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, monkeypatch, mock_executor_service, executor_response, mocked_executor):
        mock_executor_service.crud.get_by_id.return_value = mocked_executor
        mocked_validate = Mock(return_value=executor_response)
        monkeypatch.setattr(ExecutorResponse, "model_validate", mocked_validate)

        result = await mock_executor_service.get_by_id(executor_response.id)

        assert result.id == executor_response.id
        assert result.name == executor_response.name
        assert result.source_code == executor_response.source_code
        assert result.storage == executor_response.storage
        assert result.integration_ids == executor_response.integration_ids
        assert result.command_args == executor_response.command_args
        assert result.runtime == executor_response.runtime

        mock_executor_service.crud.get_by_id.assert_awaited_once_with(executor_response.id)
        mocked_validate.assert_called_once_with(mocked_executor)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, monkeypatch, mock_executor_service, mocked_executor):
        mock_executor_service.crud.get_by_id.return_value = mocked_executor

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ExecutorResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_executor_service.get_by_id(mocked_executor.id)

        assert exc.value is error
        mock_executor_service.crud.get_by_id.assert_awaited_once_with(mocked_executor.id)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_executor_service, mock_executor_crud):
        mock_executor_crud.get_all.return_value = []

        result = await mock_executor_service.get_all(limit=10)

        assert result == []
        mock_executor_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_executor_service,
        mock_executor_crud,
        monkeypatch,
        mocked_user_response,
        storage_response,
        mocked_source_code_response,
    ):
        executors = [
            Executor(
                id=uuid4(),
                name="Test Executor1",
                source_code={"id": uuid4(), "name": "source1"},
                runtime="opentofu",
                command_args="-var-file=environments/dev/eu-west-1.tfvars",
            ),
            Executor(
                id=uuid4(),
                name="Test Executor2",
                source_code={"id": uuid4(), "name": "source2"},
                runtime="opentofu",
                command_args="-var-file=environments/dev/eu-west-1.tfvars",
            ),
        ]
        mock_executor_crud.get_all.return_value = executors

        executor_response_1 = ExecutorResponse(
            id=uuid4(),
            name="Test Executor 1",
            source_code=mocked_source_code_response,
            creator=mocked_user_response,
            storage=storage_response,
            runtime="opentofu",
            command_args="-apply",
        )
        executor_response_2 = ExecutorResponse(
            id=uuid4(),
            name="Test Executor 2",
            source_code=mocked_source_code_response,
            creator=mocked_user_response,
            storage=storage_response,
            runtime="opentofu",
            command_args="-plan",
        )

        def mock_model_validate_validate(arg):
            return executor_response_1 if arg.name == "Test Executor1" else executor_response_2

        monkeypatch.setattr(ExecutorResponse, "model_validate", mock_model_validate_validate)

        result = await mock_executor_service.get_all(limit=10, offset=0)

        assert result == [executor_response_1, executor_response_2]
        mock_executor_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_executor_service, mock_executor_crud, monkeypatch, mocked_executor):
        mock_executor_crud.get_all.return_value = [mocked_executor]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ExecutorResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_executor_service.get_all(limit=10)

        assert exc.value is error
        mock_executor_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_executor_service, mock_executor_crud):
        mock_executor_crud.count.return_value = 1

        result = await mock_executor_service.count(filter={"key": "value"})

        assert result == 1

        mock_executor_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_executor_service, mock_executor_crud):
        error = RuntimeError("db failure")
        mock_executor_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_executor_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_executor_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_storage,
        mock_storage_crud,
        mocked_executor,
        mocked_source_code,
        mock_source_code_crud,
        storage_response,
        mocked_user_response,
    ):
        executor_create = ExecutorCreate(
            name=mocked_executor.name,
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="-apply",
        )

        expected_executor_body = {
            "name": mocked_executor.name,
            "created_by": mocked_user_response.id,
            "source_code_id": mocked_source_code.id,
            "source_code_version": "v1.0.0",
            "source_code_folder": "executors/",
            "storage_id": storage_response.id,
            "storage_path": "path/to/storage",
            "runtime": "opentofu",
            "command_args": "-apply",
        }
        requester = mocked_user_response

        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_storage_crud.get_by_id.return_value = mocked_storage

        new_executor = mocked_executor
        new_executor.state = ModelState.PROVISION
        new_executor.status = ModelStatus.READY
        new_executor.created_by = requester.id

        mock_executor_crud.create.return_value = new_executor
        mock_executor_crud.get_by_id.return_value = new_executor

        result = await mock_executor_service.create(executor_create, requester)

        mock_executor_crud.create.assert_awaited_once_with(expected_executor_body)

        assert result.state == ModelState.PROVISION
        assert result.status == ModelStatus.READY

        mock_revision_handler.handle_revision.assert_awaited_once_with(new_executor)
        mock_audit_log_handler.create_log.assert_awaited_once_with(new_executor.id, requester.id, ModelActions.CREATE)
        response = ExecutorResponse.model_validate(new_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.CREATE)

        assert result.source_code.id == mocked_source_code.id
        assert result.name == mocked_executor.name
        assert result.storage.id == storage_response.id

    @pytest.mark.asyncio
    async def test_create_with_branch_success(
        self,
        mock_executor_service,
        mock_executor_crud,
        mocked_storage,
        mock_storage_crud,
        mocked_executor,
        mocked_source_code,
        mock_source_code_crud,
        storage_response,
        mocked_user_response,
    ):
        executor_create = ExecutorCreate(
            name=mocked_executor.name,
            source_code_id=mocked_source_code.id,
            source_code_branch="main",
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="-apply",
        )

        requester = mocked_user_response

        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_storage_crud.get_by_id.return_value = mocked_storage

        new_executor = mocked_executor
        new_executor.state = ModelState.PROVISION
        new_executor.status = ModelStatus.READY
        new_executor.created_by = requester.id

        mock_executor_crud.create.return_value = new_executor
        mock_executor_crud.get_by_id.return_value = new_executor

        result = await mock_executor_service.create(executor_create, requester)

        assert result.name == mocked_executor.name

    @pytest.mark.asyncio
    async def test_create_missing_version_and_branch_error(
        self,
        mock_executor_service,
        mocked_user_response,
        mocked_source_code,
        storage_response,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="-apply",
        )

        requester = mocked_user_response

        with pytest.raises(ValueError, match="One of source code tag or branch is required"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_both_version_and_branch_error(
        self,
        mock_executor_service,
        mocked_user_response,
        mocked_source_code,
        storage_response,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_branch="main",
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response

        with pytest.raises(ValueError, match="Only one of source code tag or branch is allowed"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_source_code_not_found(
        self,
        mock_executor_service,
        mock_source_code_crud,
        mocked_user_response,
        storage_response,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=uuid4(),
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response
        mock_source_code_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Source code not found"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_source_code_disabled(
        self,
        mock_executor_service,
        mock_source_code_crud,
        mocked_user_response,
        mocked_source_code,
        storage_response,
    ):
        mocked_source_code.status = ModelStatus.DISABLED
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(EntityWrongState, match="SourceCode is not enabled"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_missing_storage_for_opentofu(
        self,
        mock_executor_service,
        mock_source_code_crud,
        mocked_user_response,
        mocked_source_code,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(ValueError, match="Storage is required for opentofu executors"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_storage_not_found(
        self,
        mock_executor_service,
        mock_source_code_crud,
        mock_storage_crud,
        mocked_user_response,
        mocked_source_code,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            storage_id=uuid4(),
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response
        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_storage_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Storage not found"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_missing_storage_path(
        self,
        mock_executor_service,
        mock_source_code_crud,
        mock_storage_crud,
        mocked_user_response,
        mocked_source_code,
        mocked_storage,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            storage_id=mocked_storage.id,
            storage_path="",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response
        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_storage_crud.get_by_id.return_value = mocked_storage

        with pytest.raises(ValueError, match="Storage path is required for executors with storage"):
            await mock_executor_service.create(executor_create, requester)

    @pytest.mark.asyncio
    async def test_create_error(
        self,
        mock_executor_service,
        mock_executor_crud,
        mocked_storage,
        mock_storage_crud,
        mocked_user_response,
        mocked_source_code,
        mock_source_code_crud,
        storage_response,
    ):
        executor_create = ExecutorCreate(
            name="TestExecutor",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            source_code_folder="executors/",
            storage_id=storage_response.id,
            storage_path="path/to/storage",
            runtime="opentofu",
            command_args="apply",
        )

        requester = mocked_user_response
        mock_storage_crud.get_by_id.return_value = mocked_storage
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        error = RuntimeError("create fail")
        mock_executor_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_executor_service.create(executor_create, requester)

        assert exc.value is error
        mock_executor_crud.create.assert_awaited_once()


class TestDelete:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.DESTROYED, ModelStatus.DONE),
            (ModelState.PROVISION, ModelStatus.READY),
        ],
    )
    async def test_delete_success(
        self,
        state,
        status,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
        mock_user_dto,
        monkeypatch,
    ):
        existing_executor = mocked_executor
        existing_executor.state = state
        existing_executor.status = status

        mock_executor_crud.get_by_id.return_value = existing_executor

        # Mock the delete_executor_policies function
        mock_delete_policies = AsyncMock()
        monkeypatch.setattr("application.executors.service.delete_executor_policies", mock_delete_policies)

        await mock_executor_service.delete(executor_id=existing_executor.id, requester=mock_user_dto)

        mock_executor_crud.get_by_id.assert_awaited_once_with(existing_executor.id)
        mock_executor_crud.delete.assert_awaited_once_with(existing_executor)
        mock_log_crud.delete_by_entity_id.assert_awaited_once_with(existing_executor.id)
        mock_revision_handler.delete_revisions.assert_awaited_once_with(existing_executor.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_executor.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_task_entity_crud.delete_by_entity_id.assert_awaited_once_with(existing_executor.id)
        mock_delete_policies.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_delete_executor_does_not_exist(
        self,
        mock_executor_service,
        mock_executor_crud,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
    ):
        requester = Mock(spec=UserDTO)

        mock_executor_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Executor not found"):
            await mock_executor_service.delete(executor_id=EXECUTOR_ID, requester=requester)
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()


class TestGetExecutorActions:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status,state,user_permissions,expected_actions",
        [
            # Wrong executor state - in progress
            (
                ModelStatus.IN_PROGRESS,
                ModelState.PROVISION,
                ["read", "write", "admin"],
                [],
            ),
            # Read permission only
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read"],
                [],
            ),
            # Write permission - PROVISIONED state
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read", "write"],
                [
                    ModelActions.DESTROY,
                    ModelActions.EXECUTE,
                    ModelActions.DRYRUN,
                ],
            ),
            # Admin permission - PROVISIONED state
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read", "write", "admin"],
                [
                    ModelActions.DESTROY,
                    ModelActions.EXECUTE,
                    ModelActions.EDIT,
                    ModelActions.DRYRUN,
                ],
            ),
            # Write permission - PROVISION state READY status
            (
                ModelStatus.READY,
                ModelState.PROVISION,
                ["read", "write"],
                [
                    ModelActions.EXECUTE,
                    ModelActions.DRYRUN,
                    ModelActions.DELETE,
                ],
            ),
            # Admin permission - PROVISION state READY status
            (
                ModelStatus.READY,
                ModelState.PROVISION,
                ["read", "write", "admin"],
                [
                    ModelActions.EXECUTE,
                    ModelActions.EDIT,
                    ModelActions.DRYRUN,
                    ModelActions.DELETE,
                ],
            ),
            # Write permission - DESTROYED state
            (
                ModelStatus.DONE,
                ModelState.DESTROYED,
                ["read", "write"],
                [ModelActions.RECREATE],
            ),
            # Admin permission - DESTROYED state
            (
                ModelStatus.DONE,
                ModelState.DESTROYED,
                ["read", "write", "admin"],
                [ModelActions.RECREATE, ModelActions.DELETE],
            ),
            # Write permission - DESTROY state ERROR status
            (
                ModelStatus.ERROR,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.RECREATE, ModelActions.EXECUTE, ModelActions.DRYRUN],
            ),
            # Write permission - DESTROY state READY status
            (
                ModelStatus.READY,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.RECREATE, ModelActions.EXECUTE, ModelActions.DRYRUN],
            ),
            # QUEUED status - no admin
            (
                ModelStatus.QUEUED,
                ModelState.PROVISION,
                ["read", "write"],
                [],
            ),
            # QUEUED status - with admin
            (
                ModelStatus.QUEUED,
                ModelState.PROVISION,
                ["read", "write", "admin"],
                [ModelActions.RETRY],
            ),
        ],
    )
    async def test_get_executor_user_actions(
        self,
        status,
        state,
        user_permissions,
        expected_actions,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = status
        existing_executor.state = state

        mock_user_permissions(user_permissions, monkeypatch, "application.executors.service.user_entity_permissions")
        mock_executor_crud.get_by_id.return_value = mocked_executor

        result = await mock_executor_service.get_actions(executor_id=mocked_executor.id, requester=mock_user_dto)

        assert sorted(result) == sorted(expected_actions)


class TestPatchAction:
    # Destroy action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.DESTROY, ModelStatus.READY),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.DESTROY, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.DESTROY, ModelStatus.READY),
        ],
    )
    async def test_patch_destroy(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_executor_service,
        mock_executor_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
        mocked_executor,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)

        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = status
        existing_executor.state = state

        mock_executor_crud.get_by_id.return_value = existing_executor

        result = await mock_executor_service.patch_action(
            executor_id=executor_id, body=patch_body, requester=mocked_user
        )

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_executor.id, mocked_user.id, ModelActions.DESTROY
        )

        response = ExecutorResponse.model_validate(existing_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DESTROY)

        assert result.status == expected_status
        assert result.state == expected_state

    @pytest.mark.asyncio
    async def test_reset_action_success(
        self,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RESET)
        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = ModelStatus.IN_PROGRESS
        existing_executor.state = ModelState.PROVISION
        existing_executor.updated_at = datetime.now(UTC) - timedelta(minutes=11)

        mock_executor_crud.get_by_id.return_value = existing_executor

        result = await mock_executor_service.patch_action(
            executor_id=executor_id, body=patch_body, requester=mocked_user
        )

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once_with(executor_id, mocked_user.id, ModelActions.RESET)

        response = ExecutorResponse.model_validate(existing_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.RESET)

        assert result.status == ModelStatus.ERROR
        assert result.state == ModelState.PROVISION

    @pytest.mark.asyncio
    async def test_reset_action_invalid_status(
        self,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RESET)
        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = ModelStatus.READY
        existing_executor.state = ModelState.PROVISION
        existing_executor.updated_at = datetime.now(UTC) - timedelta(minutes=11)

        mock_executor_crud.get_by_id.return_value = existing_executor

        with pytest.raises(ValueError, match="Only executors in IN_PROGRESS status can be reset"):
            await mock_executor_service.patch_action(executor_id=executor_id, body=patch_body, requester=mocked_user)

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once_with(executor_id, mocked_user.id, ModelActions.RESET)
        mock_event_sender.send_event.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_reset_action_too_recent_updated_at(
        self,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RESET)
        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = ModelStatus.IN_PROGRESS
        existing_executor.state = ModelState.PROVISION
        existing_executor.updated_at = datetime.now(UTC) - timedelta(minutes=5)

        mock_executor_crud.get_by_id.return_value = existing_executor

        with pytest.raises(EntityWrongState, match="Executor is in progress"):
            await mock_executor_service.patch_action(executor_id=executor_id, body=patch_body, requester=mocked_user)

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once_with(executor_id, mocked_user.id, ModelActions.RESET)
        mock_event_sender.send_event.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_patch_executor_does_not_exist(self, mock_executor_service, mock_executor_crud):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)
        requester = Mock(spec=UserDTO)

        mock_executor_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Executor not found"):
            await mock_executor_service.patch_action(executor_id=EXECUTOR_ID, body=patch_body, requester=requester)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.DESTROY, ModelStatus.READY),
            (ModelState.DESTROYED, ModelStatus.DONE),
        ],
    )
    async def test_patch_destroy_already_destroyed(
        self, state, status, mock_executor_service, mock_executor_crud, mocked_user, mocked_executor
    ):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)

        existing_executor = mocked_executor
        existing_executor.id = uuid4()
        existing_executor.status = status
        existing_executor.state = state
        mock_executor_crud.get_by_id.return_value = existing_executor

        with pytest.raises(ValueError, match="Executor is already in"):
            await mock_executor_service.patch_action(
                executor_id=existing_executor.id, body=patch_body, requester=mocked_user
            )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.PROVISIONED, ModelStatus.IN_PROGRESS),
            (ModelState.PROVISION, ModelStatus.QUEUED),
        ],
    )
    async def test_patch_destroy_invalid_status(
        self, state, status, mock_executor_service, mock_executor_crud, mocked_user, mocked_executor
    ):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)

        existing_executor = mocked_executor
        existing_executor.id = uuid4()
        existing_executor.status = status
        existing_executor.state = state
        mock_executor_crud.get_by_id.return_value = existing_executor

        with pytest.raises(ValueError, match="Cannot destroy a executor in"):
            await mock_executor_service.patch_action(
                executor_id=existing_executor.id, body=patch_body, requester=mocked_user
            )

    # Recreate action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.DESTROY, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.DESTROYED, ModelStatus.DONE, ModelState.PROVISION, ModelStatus.READY),
        ],
    )
    async def test_patch_recreate(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_executor_service,
        mock_executor_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
        mocked_executor,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RECREATE)

        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = status
        existing_executor.state = state

        mock_executor_crud.get_by_id.return_value = existing_executor

        result = await mock_executor_service.patch_action(
            executor_id=executor_id, body=patch_body, requester=mocked_user
        )

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_executor.id, mocked_user.id, ModelActions.RECREATE
        )

        response = ExecutorResponse.model_validate(existing_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.RECREATE)

        assert result.status == expected_status
        assert result.state == expected_state

    # Execute action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.QUEUED),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.QUEUED),
            (ModelState.PROVISIONED, ModelStatus.ERROR, ModelState.PROVISIONED, ModelStatus.QUEUED),
            (ModelState.DESTROY, ModelStatus.READY, ModelState.DESTROY, ModelStatus.QUEUED),
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.PROVISIONED, ModelStatus.QUEUED),
        ],
    )
    async def test_patch_execute_action(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.EXECUTE)

        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = status
        existing_executor.state = state

        mock_executor_crud.get_by_id.return_value = existing_executor

        result = await mock_executor_service.patch_action(
            executor_id=executor_id, body=patch_body, requester=mocked_user
        )

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_executor.id, mocked_user.id, ModelActions.EXECUTE
        )

        response = ExecutorResponse.model_validate(existing_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.EXECUTE)

        assert result.status == expected_status
        assert result.state == expected_state

    # Dryrun action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISIONED, ModelStatus.ERROR),
            (ModelState.PROVISIONED, ModelStatus.DONE),
        ],
    )
    async def test_patch_dryrun_action(
        self,
        state,
        status,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DRYRUN)

        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = status
        existing_executor.state = state

        mock_executor_crud.get_by_id.return_value = existing_executor

        result = await mock_executor_service.patch_action(
            executor_id=executor_id, body=patch_body, requester=mocked_user
        )

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_executor.id, mocked_user.id, ModelActions.DRYRUN
        )

        response = ExecutorResponse.model_validate(existing_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DRYRUN)

        # Dryrun doesn't change status/state
        assert result.status == status
        assert result.state == state

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.PROVISION, ModelStatus.QUEUED),
            (ModelState.PROVISIONED, ModelStatus.IN_PROGRESS),
        ],
    )
    async def test_patch_dryrun_invalid_status(
        self, state, status, mock_executor_service, mock_executor_crud, mocked_user, mocked_executor
    ):
        patch_body = PatchBodyModel(action=ModelActions.DRYRUN)

        existing_executor = mocked_executor
        existing_executor.id = uuid4()
        existing_executor.status = status
        existing_executor.state = state
        mock_executor_crud.get_by_id.return_value = existing_executor

        with pytest.raises(EntityWrongState, match="Dry run is only allowed for executors in"):
            await mock_executor_service.patch_action(
                executor_id=existing_executor.id, body=patch_body, requester=mocked_user
            )

    # Retry action
    @pytest.mark.asyncio
    async def test_retry_action(
        self,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RETRY)
        executor_id = uuid4()
        existing_executor = mocked_executor
        existing_executor.id = executor_id
        existing_executor.status = ModelStatus.QUEUED
        existing_executor.state = ModelState.PROVISIONED
        mock_executor_crud.get_by_id.return_value = existing_executor

        result = await mock_executor_service.patch_action(
            executor_id=executor_id, body=patch_body, requester=mocked_user
        )

        mock_executor_crud.get_by_id.assert_awaited_once_with(executor_id)
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_executor.id, mocked_user.id, ModelActions.RETRY
        )

        response = ExecutorResponse.model_validate(existing_executor)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.RETRY)

        assert result.status == ModelStatus.QUEUED
        assert result.state == ModelState.PROVISIONED

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISIONED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.IN_PROGRESS),
        ],
    )
    async def test_retry_invalid_status(
        self, state, status, mock_executor_service, mock_executor_crud, mocked_user, mocked_executor
    ):
        patch_body = PatchBodyModel(action=ModelActions.RETRY)

        existing_executor = mocked_executor
        existing_executor.id = uuid4()
        existing_executor.status = status
        existing_executor.state = state
        mock_executor_crud.get_by_id.return_value = existing_executor

        with pytest.raises(EntityWrongState, match="Only executors in QUEUED status can be retried"):
            await mock_executor_service.patch_action(
                executor_id=existing_executor.id, body=patch_body, requester=mocked_user
            )
