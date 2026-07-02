from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_EXECUTOR_MUTATION = """
    mutation CreateExecutor($input: ExecutorCreateInput!) {
        createExecutor(input: $input) {
            id
            name
            entityName
        }
    }
"""

UPDATE_EXECUTOR_MUTATION = """
    mutation UpdateExecutor($id: UUID!, $input: ExecutorUpdateInput!) {
        updateExecutor(id: $id, input: $input) {
            id
            name
            entityName
        }
    }
"""

EXECUTOR_ACTION_MUTATION = """
    mutation ExecutorAction($id: UUID!, $input: ExecutorActionInput!) {
        executorAction(id: $id, input: $input) {
            id
            name
            entityName
        }
    }
"""

DELETE_EXECUTOR_MUTATION = """
    mutation DeleteExecutor($id: UUID!) {
        deleteExecutor(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestExecutorMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.executor.mutations.get_executor_service")
    @patch("graphql_api.modules.executor.mutations.get_favorite_service")
    async def test_create_executor_returns_created_executor(
        self,
        mock_get_favorite_service,
        mock_get_service,
        mocked_executor,
        mocked_user,
    ):
        service = Mock()
        service.create_executor = AsyncMock(return_value=mocked_executor)
        mock_get_service.return_value = service
        mock_get_favorite_service.return_value = Mock()

        result = await schema.execute(
            CREATE_EXECUTOR_MUTATION,
            variable_values={"input": {"name": "GraphQL Executor", "sourceCodeId": str(uuid4())}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "createExecutor": {
                "id": str(mocked_executor.id),
                "name": mocked_executor.name,
                "entityName": "executor",
            }
        }
        service.create_executor.assert_awaited_once_with(executor=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.executor.mutations.get_executor_service")
    @patch("graphql_api.modules.executor.mutations.get_favorite_service")
    async def test_update_executor_returns_updated_executor(
        self,
        mock_get_favorite_service,
        mock_get_service,
        mocked_executor,
        mocked_user,
    ):
        executor_id = uuid4()
        service = Mock()
        service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        service.update_executor = AsyncMock(return_value=mocked_executor)
        mock_get_service.return_value = service
        mock_get_favorite_service.return_value = Mock()

        result = await schema.execute(
            UPDATE_EXECUTOR_MUTATION,
            variable_values={"id": str(executor_id), "input": {"description": "Updated executor"}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "updateExecutor": {
                "id": str(mocked_executor.id),
                "name": mocked_executor.name,
                "entityName": "executor",
            }
        }
        service.update_executor.assert_awaited_once_with(
            executor_id=str(executor_id), executor=ANY, requester=mocked_user
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.executor.mutations.get_executor_service")
    @patch("graphql_api.modules.executor.mutations.get_favorite_service")
    async def test_executor_action_returns_updated_executor(
        self,
        mock_get_favorite_service,
        mock_get_service,
        mocked_executor,
        mocked_user,
    ):
        executor_id = uuid4()
        service = Mock()
        service.get_actions = AsyncMock(return_value=[ModelActions.DISABLE.value])
        service.patch_action_executor = AsyncMock(return_value=mocked_executor)
        mock_get_service.return_value = service
        mock_get_favorite_service.return_value = Mock()

        result = await schema.execute(
            EXECUTOR_ACTION_MUTATION,
            variable_values={"id": str(executor_id), "input": {"action": ModelActions.DISABLE.value}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "executorAction": {
                "id": str(mocked_executor.id),
                "name": mocked_executor.name,
                "entityName": "executor",
            }
        }
        service.patch_action_executor.assert_awaited_once_with(
            executor_id=str(executor_id),
            body=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.executor.mutations.get_executor_service")
    @patch("graphql_api.modules.executor.mutations.get_favorite_service")
    async def test_delete_executor_returns_true(
        self,
        mock_get_favorite_service,
        mock_get_service,
        mocked_user,
    ):
        executor_id = uuid4()
        service = Mock()
        service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        service.delete = AsyncMock()
        mock_get_service.return_value = service
        mock_get_favorite_service.return_value = Mock()

        result = await schema.execute(
            DELETE_EXECUTOR_MUTATION,
            variable_values={"id": str(executor_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteExecutor": True}
        service.delete.assert_awaited_once_with(executor_id=str(executor_id), requester=mocked_user)
