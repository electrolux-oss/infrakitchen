from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from graphql_api.schema import schema

CREATE_BATCH_OPERATION_MUTATION = """
    mutation CreateBatchOperation($input: BatchOperationCreateInput!) {
        createBatchOperation(input: $input) {
            id
            name
            entityType
            entityIds
        }
    }
"""

BATCH_OPERATION_ENTITY_IDS_MUTATION = """
    mutation BatchOperationEntityIds($id: UUID!, $input: BatchOperationEntityIdsInput!) {
        batchOperationEntityIds(id: $id, input: $input) {
            id
            entityIds
        }
    }
"""

DELETE_BATCH_OPERATION_MUTATION = """
    mutation DeleteBatchOperation($id: UUID!) {
        deleteBatchOperation(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestBatchOperationMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_create_batch_operation_returns_created(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_batch_operation,
        mocked_user,
    ):
        mock_batch_operation_service.create_batch_operation = AsyncMock(return_value=mocked_batch_operation)
        mock_get_service.return_value = mock_batch_operation_service

        result = await schema.execute(
            CREATE_BATCH_OPERATION_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Batch",
                    "entityType": "resource",
                    "entityIds": [str(uuid4())],
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createBatchOperation"]["id"] == str(mocked_batch_operation.id)
        assert result.data["createBatchOperation"]["name"] == mocked_batch_operation.name
        assert result.data["createBatchOperation"]["entityType"] == mocked_batch_operation.entity_type
        mock_batch_operation_service.create_batch_operation.assert_awaited_once_with(
            batch_operation=ANY, requester=mocked_user
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_create_batch_operation_requires_authentication(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_user,
    ):
        mock_batch_operation_service.create_batch_operation = AsyncMock()
        mock_get_service.return_value = mock_batch_operation_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_BATCH_OPERATION_MUTATION,
            variable_values={
                "input": {
                    "name": "GraphQL Batch",
                    "entityType": "resource",
                    "entityIds": [str(uuid4())],
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createBatchOperation"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_batch_operation_service.create_batch_operation.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_entity_ids_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_user,
    ):
        mock_batch_operation_service.get_actions = AsyncMock()
        mock_batch_operation_service.patch_entity_ids_orm = AsyncMock()
        mock_get_service.return_value = mock_batch_operation_service

        result = await schema.execute(
            BATCH_OPERATION_ENTITY_IDS_MUTATION,
            variable_values={
                "id": str(uuid4()),
                "input": {"action": "unknown", "entityIds": [str(uuid4())]},
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["batchOperationEntityIds"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_batch_operation_service.get_actions.assert_not_awaited()
        mock_batch_operation_service.patch_entity_ids_orm.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_entity_ids_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_user,
    ):
        batch_operation_id = uuid4()
        mock_batch_operation_service.get_actions = AsyncMock(return_value=[])
        mock_batch_operation_service.patch_entity_ids_orm = AsyncMock()
        mock_get_service.return_value = mock_batch_operation_service

        result = await schema.execute(
            BATCH_OPERATION_ENTITY_IDS_MUTATION,
            variable_values={
                "id": str(batch_operation_id),
                "input": {"action": "remove", "entityIds": [str(uuid4())]},
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["batchOperationEntityIds"] is None
        assert result.errors is not None
        assert any("Access denied for action remove" in error.message for error in result.errors)
        mock_batch_operation_service.get_actions.assert_awaited_once_with(
            batch_operation_id=batch_operation_id, requester=mocked_user
        )
        mock_batch_operation_service.patch_entity_ids_orm.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_entity_ids_returns_updated(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_batch_operation,
        mocked_user,
    ):
        batch_operation_id = uuid4()
        mock_batch_operation_service.get_actions = AsyncMock(return_value=["add", "remove"])
        mock_batch_operation_service.patch_entity_ids_orm = AsyncMock(return_value=mocked_batch_operation)
        mock_get_service.return_value = mock_batch_operation_service

        result = await schema.execute(
            BATCH_OPERATION_ENTITY_IDS_MUTATION,
            variable_values={
                "id": str(batch_operation_id),
                "input": {"action": "add", "entityIds": [str(uuid4())]},
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["batchOperationEntityIds"]["id"] == str(mocked_batch_operation.id)
        mock_batch_operation_service.get_actions.assert_awaited_once_with(
            batch_operation_id=batch_operation_id, requester=mocked_user
        )
        mock_batch_operation_service.patch_entity_ids_orm.assert_awaited_once()
        assert mock_batch_operation_service.patch_entity_ids_orm.await_args
        call_kwargs = mock_batch_operation_service.patch_entity_ids_orm.await_args.kwargs
        assert call_kwargs["batch_operation_id"] == batch_operation_id
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == "add"

    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_delete_denies_without_delete_action(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_user,
    ):
        batch_operation_id = uuid4()
        mock_batch_operation_service.get_actions = AsyncMock(return_value=[])
        mock_batch_operation_service.delete = AsyncMock()
        mock_get_service.return_value = mock_batch_operation_service

        result = await schema.execute(
            DELETE_BATCH_OPERATION_MUTATION,
            variable_values={"id": str(batch_operation_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteBatchOperation"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_batch_operation_service.get_actions.assert_awaited_once_with(
            batch_operation_id=batch_operation_id, requester=mocked_user
        )
        mock_batch_operation_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.batch_operation.mutations.get_batch_operation_service")
    async def test_delete_returns_true(
        self,
        mock_get_service,
        mock_batch_operation_service,
        mocked_user,
    ):
        batch_operation_id = uuid4()
        mock_batch_operation_service.get_actions = AsyncMock(return_value=["delete"])
        mock_batch_operation_service.delete = AsyncMock()
        mock_get_service.return_value = mock_batch_operation_service

        result = await schema.execute(
            DELETE_BATCH_OPERATION_MUTATION,
            variable_values={"id": str(batch_operation_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteBatchOperation": True}
        mock_batch_operation_service.get_actions.assert_awaited_once_with(
            batch_operation_id=batch_operation_id, requester=mocked_user
        )
        mock_batch_operation_service.delete.assert_awaited_once_with(
            batch_operation_id=batch_operation_id, requester=mocked_user
        )
