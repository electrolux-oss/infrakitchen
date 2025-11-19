import pytest
from unittest.mock import Mock

from pydantic import PydanticUserError
from uuid import uuid4

from application.storages.model import Storage
from application.storages.schema import StorageResponse, StorageCreate, StorageUpdate
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants import ModelState, ModelStatus
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound, EntityWrongState

STORAGE_ID = "abc123"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_storage_service, mock_storage_crud):
        mock_storage_crud.get_by_id.return_value = None

        result = await mock_storage_service.get_by_id("invalid_id")

        assert result is None
        mock_storage_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_storage_service, mock_storage_crud, monkeypatch, mocked_storage, storage_response
    ):
        mock_storage_crud.get_by_id.return_value = mocked_storage
        mocked_validate = Mock(return_value=storage_response)
        monkeypatch.setattr(StorageResponse, "model_validate", mocked_validate)

        result = await mock_storage_service.get_by_id(STORAGE_ID)

        assert result.name == mocked_storage.name

        mock_storage_crud.get_by_id.assert_awaited_once_with(STORAGE_ID)
        mocked_validate.assert_called_once_with(mocked_storage)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_storage_service, mock_storage_crud, monkeypatch, mocked_storage):
        mock_storage_crud.get_by_id.return_value = mocked_storage

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(StorageResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_storage_service.get_by_id(STORAGE_ID)

        assert exc.value is error
        mock_storage_crud.get_by_id.assert_awaited_once_with(STORAGE_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_storage_service, mock_storage_crud):
        mock_storage_crud.get_all.return_value = []

        result = await mock_storage_service.get_all(limit=10)

        assert result == []
        mock_storage_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_storage_service,
        mock_storage_crud,
        monkeypatch,
        mocked_storage,
        mocked_user_response,
        mocked_integration_response,
    ):
        storage1 = mocked_storage
        storage2 = mocked_storage
        storage2.id = uuid4()
        storages = [storage1, storage2]
        mock_storage_crud.get_all.return_value = storages

        storage_response_1 = StorageResponse(
            id=storage1.id,
            name=storage1.name,
            storage_provider=storage1.storage_provider,
            storage_type=storage1.storage_type,
            creator=mocked_user_response,
            integration=mocked_integration_response,
            configuration=storage1.configuration,
        )
        storage_response_2 = StorageResponse(
            id=storage2.id,
            name=storage2.name,
            storage_provider=storage2.storage_provider,
            storage_type=storage2.storage_type,
            creator=mocked_user_response,
            integration=mocked_integration_response,
            configuration=storage2.configuration,
        )

        def mock_model_validate_validate(arg):
            return storage_response_1 if arg.id == storage1.id else storage_response_2

        monkeypatch.setattr(StorageResponse, "model_validate", mock_model_validate_validate)

        result = await mock_storage_service.get_all(limit=10, offset=0)

        assert result[0].name == storage1.name
        assert result[1].name == storage2.name
        mock_storage_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_storage_service, mock_storage_crud, monkeypatch, mocked_storage):
        mock_storage_crud.get_all.return_value = [mocked_storage]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(StorageResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_storage_service.get_all(limit=10)

        assert exc.value is error
        mock_storage_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_storage_service, mock_storage_crud):
        mock_storage_crud.count.return_value = 1

        result = await mock_storage_service.count(filter={"key": "value"})

        assert result == 1

        mock_storage_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_storage_service, mock_storage_crud):
        error = RuntimeError("db failure")
        mock_storage_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_storage_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_storage_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_storage_service,
        mock_storage_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_storage,
        mock_integration_crud,
        mocked_integration,
        mocked_user,
    ):
        mocked_integration.status = ModelStatus.ENABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration

        storage_body = {
            "name": "Test Storage",
            "storage_type": "tofu",
            "storage_provider": "aws",
            "integration_id": mocked_integration.id,
            "configuration": {
                "aws_bucket_name": "test-bucket",
                "aws_region": "us-west-2",
                "storage_provider": "aws",
            },
        }
        storage_create = StorageCreate.model_validate(storage_body)
        expected_storage_body = storage_create.model_dump(exclude_unset=True)
        expected_storage_body["created_by"] = mocked_user.id

        mock_storage_crud.create.return_value = mocked_storage
        mock_storage_crud.get_by_id.return_value = mocked_storage

        result = await mock_storage_service.create(storage_create, mocked_user)

        mock_storage_crud.create.assert_awaited_once_with(expected_storage_body)

        mock_revision_handler.handle_revision.assert_awaited_once_with(mocked_storage)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_storage.id, mocked_user.id, ModelActions.CREATE
        )
        response = StorageResponse.model_validate(mocked_storage)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.CREATE)

        assert result.state == ModelState.PROVISION
        assert result.status == ModelStatus.READY

    @pytest.mark.asyncio
    async def test_create_invalid_integration_state(
        self, mock_storage_service, mocked_integration, mocked_user, mock_integration_crud
    ):
        mocked_integration.status = ModelStatus.DISABLED
        storage_body = {
            "name": "Test Storage",
            "storage_type": "tofu",
            "storage_provider": "aws",
            "integration_id": mocked_integration.id,
            "configuration": {
                "aws_bucket_name": "test-bucket",
                "aws_region": "us-west-2",
                "storage_provider": "aws",
            },
        }
        storage_create = StorageCreate.model_validate(storage_body)
        mock_integration_crud.get_by_id.return_value = mocked_integration

        with pytest.raises(DependencyError, match="Integration must be enabled to create a storage"):
            await mock_storage_service.create(storage_create, mocked_user)

    @pytest.mark.asyncio
    async def test_create_error(
        self, mock_storage_service, mock_storage_crud, mocked_integration, mocked_user, mock_integration_crud
    ):
        storage_body = {
            "name": "Test Storage",
            "storage_type": "tofu",
            "storage_provider": "aws",
            "integration_id": mocked_integration.id,
            "configuration": {
                "aws_bucket_name": "test-bucket",
                "aws_region": "us-west-2",
                "storage_provider": "aws",
            },
        }
        storage_create = StorageCreate.model_validate(storage_body)
        mock_integration_crud.get_by_id.return_value = mocked_integration

        error = RuntimeError("create fail")
        mock_storage_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_storage_service.create(storage_create, mocked_user)

        assert exc.value is error
        mock_storage_crud.create.assert_awaited_once()


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_storage_service,
        mock_storage_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_storage,
        storage_response,
    ):
        storage_update = StorageUpdate(description="Storage description")
        storage_id = uuid4()
        existing_storage = mocked_storage
        existing_storage.id = storage_id
        existing_storage.state = ModelState.PROVISIONED

        updated_storage = Storage(
            id=storage_id,
            name="Test Storage",
            state=ModelState.PROVISIONED,
            status=ModelStatus.READY,
        )
        storage_response_with_update = storage_response
        storage_response_with_update.id = storage_id
        storage_response_with_update.state = ModelState.PROVISIONED
        storage_response_with_update.status = ModelStatus.READY

        mock_storage_crud.get_by_id.return_value = existing_storage
        mock_storage_crud.update.return_value = updated_storage
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(StorageResponse, "model_validate", Mock(return_value=storage_response))

        result = await mock_storage_service.update(storage_id=storage_id, storage=storage_update, requester=requester)

        mock_storage_crud.get_by_id.assert_awaited_once_with(storage_id)
        mock_storage_crud.update.assert_awaited_once_with(
            existing_storage, storage_update.model_dump(exclude_unset=True)
        )

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            updated_storage.id, requester.id, ModelActions.UPDATE
        )
        mock_storage_crud.refresh.assert_awaited_once_with(existing_storage)
        mock_revision_handler.handle_revision.assert_awaited_once_with(existing_storage)
        response = StorageResponse.model_validate(updated_storage)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.UPDATE)

        assert result.state == ModelState.PROVISIONED
        assert result.status == ModelStatus.READY

    @pytest.mark.asyncio
    async def test_update_storage_does_not_exist(self, mock_storage_service, mock_storage_crud):
        storage_update = Mock(spec=StorageUpdate)
        requester = Mock(spec=UserDTO)

        mock_storage_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Storage not found"):
            await mock_storage_service.update(storage_id=STORAGE_ID, storage=storage_update, requester=requester)

    @pytest.mark.asyncio
    async def test_update_storage_has_status_queued(self, mock_storage_service, mock_storage_crud):
        storage_update = Mock(spec=StorageUpdate)
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        existing_storage = Storage(
            id=uuid4(),
            name="Test Storage",
            status=ModelStatus.QUEUED,
            state=ModelState.PROVISION,
        )
        mock_storage_crud.get_by_id.return_value = existing_storage

        with pytest.raises(ValueError):
            await mock_storage_service.update(storage_id=STORAGE_ID, storage=storage_update, requester=requester)

    @pytest.mark.asyncio
    async def test_update_storage_has_invalid_status(self, mock_storage_service, mock_storage_crud):
        storage_update = Mock(spec=StorageUpdate)
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        existing_storage = Storage(id=uuid4(), name="Test Storage", status=None, state=None)
        mock_storage_crud.get_by_id.return_value = existing_storage

        with pytest.raises(ValueError):
            await mock_storage_service.update(storage_id=STORAGE_ID, storage=storage_update, requester=requester)

    @pytest.mark.asyncio
    async def test_update_error(self, mock_storage_service, mock_storage_crud):
        storage_update = Mock(spec=StorageUpdate)
        requester = Mock(spec=UserDTO)
        existing_storage = Storage(id=uuid4(), name="Test Storage", state=ModelState.PROVISIONED)
        mock_storage_crud.get_by_id.return_value = existing_storage

        error = RuntimeError("update fail")
        mock_storage_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_storage_service.update(storage_id=STORAGE_ID, storage=storage_update, requester=requester)

        assert exc.value is error


class TestPatch:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, status, expected_state, expected_status, action",
        [
            (ModelState.DESTROY, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY, ModelActions.RECREATE),
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.DESTROY, ModelStatus.READY, ModelActions.DESTROY),
            (
                ModelState.PROVISIONED,
                ModelStatus.READY,
                ModelState.PROVISIONED,
                ModelStatus.QUEUED,
                ModelActions.EXECUTE,
            ),
            (ModelState.DESTROY, ModelStatus.READY, ModelState.DESTROY, ModelStatus.QUEUED, ModelActions.EXECUTE),
        ],
    )
    async def test_patch_success(
        self,
        state,
        status,
        expected_state,
        expected_status,
        action,
        mock_storage_service,
        mock_storage_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_storage,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=action)
        storage_id = uuid4()
        existing_storage = mocked_storage
        existing_storage.id = storage_id

        existing_storage.state = state
        existing_storage.status = status

        mock_storage_crud.get_by_id.return_value = existing_storage
        mock_storage_crud.get_dependencies.return_value = []

        result = await mock_storage_service.patch_action(storage_id=storage_id, body=patch_body, requester=mocked_user)

        mock_storage_crud.get_by_id.assert_awaited_once_with(storage_id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(storage_id, mocked_user.id, action)
        mock_event_sender.send_event.assert_awaited_once_with(result, action)

        assert result.status == expected_status
        assert result.state == expected_state

    @pytest.mark.asyncio
    async def test_patch_error_with_dependencies(self, mock_storage_service, mock_storage_crud, storage_response):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        dependencies = [
            Mock(spec=["name", "type", "id"]),
        ]

        mock_storage_crud.get_by_id.return_value = storage_response
        mock_storage_crud.get_dependencies.return_value = dependencies

        with pytest.raises(DependencyError) as exc:
            await mock_storage_service.patch_action(storage_id=STORAGE_ID, body=patch_body, requester=requester)

        assert str(exc.value) == "Cannot delete a storage that has dependencies, dependencies"

    @pytest.mark.asyncio
    async def test_patch_error_with_wrong_state(self, mock_storage_service, mock_storage_crud):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        existing_storage = Storage(
            id=uuid4(),
            name="Test Storage",
            status=ModelStatus.READY,
            state=ModelState.PROVISION,
        )
        mock_storage_crud.get_by_id.return_value = existing_storage
        mock_storage_crud.get_dependencies.return_value = []

        with pytest.raises(EntityWrongState) as exc:
            await mock_storage_service.patch_action(storage_id=STORAGE_ID, body=patch_body, requester=requester)

        assert str(exc.value) == "Storage cannot be destroyed, has wrong state ModelState.PROVISION"

    @pytest.mark.asyncio
    async def test_patch_storage_does_not_exist(self, mock_storage_service, mock_storage_crud):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)
        requester = Mock(spec=UserDTO)

        mock_storage_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Storage not found"):
            await mock_storage_service.patch_action(storage_id=STORAGE_ID, body=patch_body, requester=requester)


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_storage_service,
        mock_storage_crud,
        mock_log_crud,
        mock_user_dto,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        existing_storage = Storage(
            id=uuid4(),
            name="Test Storage",
            status=ModelStatus.DONE,
            state=ModelState.DESTROYED,
        )
        mock_storage_crud.get_by_id.return_value = existing_storage

        await mock_storage_service.delete(storage_id=existing_storage.id, requester=mock_user_dto)

        mock_storage_crud.get_by_id.assert_awaited_once_with(existing_storage.id)
        mock_storage_crud.delete.assert_awaited_once_with(existing_storage)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_storage.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_revision_handler.delete_revisions.assert_awaited_once_with(existing_storage.id)
        mock_log_crud.delete_by_entity_id.assert_awaited_once_with(existing_storage.id)
        mock_task_entity_crud.delete_by_entity_id.assert_awaited_once_with(existing_storage.id)

    @pytest.mark.asyncio
    async def test_delete_storage_does_not_exist(
        self,
        mock_storage_service,
        mock_storage_crud,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        requester = Mock(spec=UserDTO)

        mock_storage_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Storage not found"):
            await mock_storage_service.delete(storage_id=STORAGE_ID, requester=requester)

        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()


class TestGetStorageActions:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status,state,user_permissions,expected_actions",
        [
            # Wrong resource state
            (
                ModelState.PROVISION,
                ModelStatus.IN_PROGRESS,
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
            # Write permission
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read", "write"],
                [ModelActions.DESTROY, ModelActions.EDIT, ModelActions.EXECUTE],
            ),
            (
                ModelStatus.READY,
                ModelState.PROVISION,
                ["read", "write"],
                [ModelActions.EDIT, ModelActions.EXECUTE, ModelActions.DELETE],
            ),
            (
                ModelStatus.DONE,
                ModelState.DESTROYED,
                ["read", "write"],
                [ModelActions.RECREATE],
            ),
            (ModelStatus.DONE, ModelState.DESTROYED, ["read", "write"], [ModelActions.RECREATE]),
            (ModelStatus.ERROR, ModelState.DESTROY, ["read", "write"], [ModelActions.RECREATE, ModelActions.EXECUTE]),
            (ModelStatus.READY, ModelState.DESTROY, ["read", "write"], [ModelActions.RECREATE, ModelActions.EXECUTE]),
            # Admin permission
            (
                ModelStatus.DONE,
                ModelState.DESTROYED,
                ["read", "write", "admin"],
                [ModelActions.RECREATE, ModelActions.DELETE],
            ),
            (ModelStatus.ERROR, ModelState.DESTROY, ["read", "write"], [ModelActions.RECREATE, ModelActions.EXECUTE]),
            (ModelStatus.READY, ModelState.DESTROY, ["read", "write"], [ModelActions.RECREATE, ModelActions.EXECUTE]),
        ],
    )
    async def test_get_storage_user_actions(
        self,
        status,
        state,
        user_permissions,
        expected_actions,
        mock_storage_service,
        mock_storage_crud,
        mocked_storage,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
        mocked_resource_temp_state_handler,
    ):
        storage_id = uuid4()
        existing_storage = mocked_storage
        existing_storage.id = storage_id
        existing_storage.status = status
        existing_storage.state = state

        mocked_resource_temp_state_handler.get_by_resource_id.return_value = None
        mock_user_permissions(user_permissions, monkeypatch, "application.storages.service.user_entity_permissions")
        mock_storage_crud.get_by_id.return_value = mocked_storage

        result = await mock_storage_service.get_actions(storage_id=mocked_storage.id, requester=mock_user_dto)

        assert sorted(result) == sorted(expected_actions)
