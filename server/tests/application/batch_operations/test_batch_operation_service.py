from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.batch_operations.schema import BatchOperationCreate
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.errors import EntityNotFound, EntityWrongState
from core.users.model import UserDTO

BATCH_OPERATION_ID = uuid4()


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_batch_operation_service):
        mock_batch_operation_service.crud.get_by_id.return_value = None

        result = await mock_batch_operation_service.get_by_id(BATCH_OPERATION_ID)

        assert result is None
        mock_batch_operation_service.crud.get_by_id.assert_awaited_once_with(BATCH_OPERATION_ID)

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        mock_batch_operation_service,
        batch_operation_response,
        mocked_batch_operation,
    ):
        mock_batch_operation_service.crud.get_by_id.return_value = mocked_batch_operation

        result = await mock_batch_operation_service.get_by_id(batch_operation_response.id)

        assert result.id == batch_operation_response.id
        assert result.name == batch_operation_response.name
        assert result.entity_type == batch_operation_response.entity_type
        assert result.entity_ids == batch_operation_response.entity_ids

        mock_batch_operation_service.crud.get_by_id.assert_awaited_once_with(batch_operation_response.id)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_batch_operation_service, mock_batch_operation_crud):
        mock_batch_operation_crud.get_all.return_value = []

        result = await mock_batch_operation_service.get_all(range=(0, 10))

        assert result == []
        mock_batch_operation_crud.get_all.assert_awaited_once_with(filter=None, range=(0, 10), sort=None)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
    ):
        mock_batch_operation_crud.get_all.return_value = [mocked_batch_operation, mocked_batch_operation]

        result = await mock_batch_operation_service.get_all(range=(0, 10), sort=("name", "ASC"))

        assert len(result) == 2
        assert result[0].id == mocked_batch_operation.id
        assert result[1].id == mocked_batch_operation.id
        mock_batch_operation_crud.get_all.assert_awaited_once_with(filter=None, range=(0, 10), sort=("name", "ASC"))


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_batch_operation_service, mock_batch_operation_crud):
        mock_batch_operation_crud.count.return_value = 1

        result = await mock_batch_operation_service.count(filter={"key": "value"})

        assert result == 1
        mock_batch_operation_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_batch_operation_service, mock_batch_operation_crud):
        error = RuntimeError("db failure")
        mock_batch_operation_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_batch_operation_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_batch_operation_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
        mocked_user_response,
    ):
        batch_operation_create = BatchOperationCreate(
            name="Test Batch Operation",
            description="Batch operation for testing",
            entity_type="resource",
            entity_ids=[uuid4(), uuid4()],
        )

        expected_body = batch_operation_create.model_dump()
        expected_body["created_by"] = mocked_user_response.id
        mock_batch_operation_crud.create.return_value = mocked_batch_operation

        result = await mock_batch_operation_service.create(batch_operation_create, mocked_user_response)

        mock_batch_operation_crud.create.assert_awaited_once_with(body=expected_body)
        assert result.id == mocked_batch_operation.id
        assert result.name == mocked_batch_operation.name
        assert result.entity_type == mocked_batch_operation.entity_type
        assert result.entity_ids == mocked_batch_operation.entity_ids


class TestPatchAction:
    @pytest.mark.asyncio
    async def test_patch_action_not_found(self, mock_batch_operation_service, mock_batch_operation_crud):
        patch_body = PatchBodyModel(action=ModelActions.DRYRUN)
        requester = Mock(spec=UserDTO)

        mock_batch_operation_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Batch operation"):
            await mock_batch_operation_service.patch_action(BATCH_OPERATION_ID, patch_body, requester)

    @pytest.mark.asyncio
    async def test_patch_action_invalid_action(self, mock_batch_operation_service, mocked_user_response):
        patch_body = PatchBodyModel(action=ModelActions.DELETE)

        with pytest.raises(ValueError, match="Unsupported action"):
            await mock_batch_operation_service.patch_action(BATCH_OPERATION_ID, patch_body, mocked_user_response)

    @pytest.mark.asyncio
    async def test_patch_action_resource_success(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
        mock_resource_service,
        mock_audit_log_handler,
        mocked_user_response,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DRYRUN)
        mocked_batch_operation.entity_type = "resource"
        mocked_batch_operation.entity_ids = [uuid4(), uuid4()]

        mock_batch_operation_crud.get_by_id.return_value = mocked_batch_operation

        mock_resource_service.patch_action = AsyncMock()

        result = await mock_batch_operation_service.patch_action(
            batch_operation_id=mocked_batch_operation.id,
            body=patch_body,
            requester=mocked_user_response,
        )

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_batch_operation.id, mocked_user_response.id, ModelActions.DRYRUN
        )
        assert result.error_entity_ids == {}
        assert mock_resource_service.patch_action.await_count == 2

    @pytest.mark.asyncio
    async def test_patch_action_resource_with_errors(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
        mock_resource_service,
        mocked_user_response,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DRYRUN)
        mocked_batch_operation.entity_type = "resource"
        resource_id = uuid4()
        mocked_batch_operation.entity_ids = [resource_id]

        mock_batch_operation_crud.get_by_id.return_value = mocked_batch_operation

        mock_resource_service.patch_action = AsyncMock(side_effect=EntityWrongState("Dry run not allowed"))

        result = await mock_batch_operation_service.patch_action(
            batch_operation_id=mocked_batch_operation.id,
            body=patch_body,
            requester=mocked_user_response,
        )

        assert result.error_entity_ids == {resource_id: "Dry run not allowed"}

    @pytest.mark.asyncio
    async def test_patch_action_executor_success(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
        mock_executor_service,
        mocked_user_response,
    ):
        patch_body = PatchBodyModel(action=ModelActions.EXECUTE)
        mocked_batch_operation.entity_type = "executor"
        mocked_batch_operation.entity_ids = [uuid4(), uuid4()]

        mock_batch_operation_crud.get_by_id.return_value = mocked_batch_operation

        mock_executor_service.patch_action = AsyncMock()

        result = await mock_batch_operation_service.patch_action(
            batch_operation_id=mocked_batch_operation.id,
            body=patch_body,
            requester=mocked_user_response,
        )

        assert result.error_entity_ids == {}
        assert mock_executor_service.patch_action.await_count == 2
