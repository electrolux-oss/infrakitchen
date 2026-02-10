from unittest.mock import Mock
from uuid import uuid4

import pytest

from application.batch_operations.schema import BatchOperationCreate, BatchOperationEntityIdsPatch
from core.errors import EntityNotFound
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


class TestPatchEntityIds:
    @pytest.mark.asyncio
    async def test_patch_entity_ids_not_found(self, mock_batch_operation_service, mock_batch_operation_crud):
        patch_body = BatchOperationEntityIdsPatch(action="remove", entity_ids=[uuid4()])
        requester = Mock(spec=UserDTO)

        mock_batch_operation_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Batch operation"):
            await mock_batch_operation_service.patch_entity_ids(BATCH_OPERATION_ID, patch_body, requester)

    @pytest.mark.asyncio
    async def test_patch_entity_ids_add(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
        mocked_user,
    ):
        existing_id = uuid4()
        new_id = uuid4()
        mocked_batch_operation.entity_ids = [existing_id]

        patch_body = BatchOperationEntityIdsPatch(action="add", entity_ids=[new_id])
        mock_batch_operation_crud.get_by_id.return_value = mocked_batch_operation
        mock_batch_operation_crud.update.return_value = mocked_batch_operation

        result = await mock_batch_operation_service.patch_entity_ids(BATCH_OPERATION_ID, patch_body, mocked_user)

        assert str(new_id) in [str(value) for value in mocked_batch_operation.entity_ids]
        assert result.id == mocked_batch_operation.id
        mock_batch_operation_crud.update.assert_awaited_once_with(mocked_batch_operation)

    @pytest.mark.asyncio
    async def test_patch_entity_ids_remove(
        self,
        mock_batch_operation_service,
        mock_batch_operation_crud,
        mocked_batch_operation,
        mocked_user,
    ):
        remove_id = uuid4()
        keep_id = uuid4()
        mocked_batch_operation.entity_ids = [remove_id, keep_id]

        patch_body = BatchOperationEntityIdsPatch(action="remove", entity_ids=[remove_id])
        mock_batch_operation_crud.get_by_id.return_value = mocked_batch_operation
        mock_batch_operation_crud.update.return_value = mocked_batch_operation

        result = await mock_batch_operation_service.patch_entity_ids(BATCH_OPERATION_ID, patch_body, mocked_user)

        assert str(remove_id) not in [str(value) for value in mocked_batch_operation.entity_ids]
        assert str(keep_id) in [str(value) for value in mocked_batch_operation.entity_ids]
        assert result.id == mocked_batch_operation.id
        mock_batch_operation_crud.update.assert_awaited_once_with(mocked_batch_operation)
