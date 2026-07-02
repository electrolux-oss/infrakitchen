from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_STORAGE_MUTATION = """
    mutation CreateStorage($input: StorageCreateInput!) {
        createStorage(input: $input) {
            id
            name
            storageType
            storageProvider
            entityName
        }
    }
"""

UPDATE_STORAGE_MUTATION = """
    mutation UpdateStorage($id: UUID!, $input: StorageUpdateInput!) {
        updateStorage(id: $id, input: $input) {
            id
            name
            description
            entityName
        }
    }
"""

STORAGE_ACTION_MUTATION = """
    mutation StorageAction($id: UUID!, $input: StorageActionInput!) {
        storageAction(id: $id, input: $input) {
            id
            name
            state
            entityName
        }
    }
"""

DELETE_STORAGE_MUTATION = """
    mutation DeleteStorage($id: UUID!) {
        deleteStorage(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestStorageMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_create_storage_returns_created_storage(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_storage,
        mocked_user,
    ):
        mock_storage_service.create_storage = AsyncMock(return_value=mocked_storage)
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            CREATE_STORAGE_MUTATION,
            variable_values={
                "input": {
                    "name": "TestStorage",
                    "storageType": "tofu",
                    "storageProvider": "aws",
                    "integrationId": str(mocked_storage.integration_id),
                    "configuration": {
                        "aws_bucket_name": "test-bucket",
                        "aws_region": "us-west-2",
                        "storage_provider": "aws",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createStorage"] == {
            "id": str(mocked_storage.id),
            "name": mocked_storage.name,
            "storageType": mocked_storage.storage_type,
            "storageProvider": mocked_storage.storage_provider,
            "entityName": "storage",
        }
        mock_storage_service.create_storage.assert_awaited_once_with(storage=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_create_storage_requires_authentication(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_storage,
        mocked_user,
    ):
        mock_storage_service.create_storage = AsyncMock()
        mock_get_service.return_value = mock_storage_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_STORAGE_MUTATION,
            variable_values={
                "input": {
                    "name": "TestStorage",
                    "storageType": "tofu",
                    "storageProvider": "aws",
                    "integrationId": str(mocked_storage.integration_id),
                    "configuration": {
                        "aws_bucket_name": "test-bucket",
                        "aws_region": "us-west-2",
                        "storage_provider": "aws",
                    },
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createStorage"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_storage_service.create_storage.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_update_storage_denies_without_edit_action(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock(return_value=[])
        mock_storage_service.update_storage = AsyncMock()
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            UPDATE_STORAGE_MUTATION,
            variable_values={
                "id": str(storage_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateStorage"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_storage_service.get_actions.assert_awaited_once_with(storage_id=storage_id, requester=mocked_user)
        mock_storage_service.update_storage.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_update_storage_returns_updated_storage(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_storage,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_storage_service.update_storage = AsyncMock(return_value=mocked_storage)
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            UPDATE_STORAGE_MUTATION,
            variable_values={
                "id": str(storage_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateStorage"] == {
            "id": str(mocked_storage.id),
            "name": mocked_storage.name,
            "description": mocked_storage.description,
            "entityName": "storage",
        }
        mock_storage_service.get_actions.assert_awaited_once_with(storage_id=storage_id, requester=mocked_user)
        mock_storage_service.update_storage.assert_awaited_once_with(
            storage_id=str(storage_id),
            storage=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_storage_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock()
        mock_storage_service.patch_action_storage = AsyncMock()
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            STORAGE_ACTION_MUTATION,
            variable_values={
                "id": str(storage_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["storageAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_storage_service.get_actions.assert_not_awaited()
        mock_storage_service.patch_action_storage.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_storage_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock(return_value=[])
        mock_storage_service.patch_action_storage = AsyncMock()
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            STORAGE_ACTION_MUTATION,
            variable_values={
                "id": str(storage_id),
                "input": {
                    "action": ModelActions.DESTROY.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["storageAction"] is None
        assert result.errors is not None
        assert any("Access denied for action destroy" in error.message for error in result.errors)
        mock_storage_service.get_actions.assert_awaited_once_with(storage_id=storage_id, requester=mocked_user)
        mock_storage_service.patch_action_storage.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_storage_action_returns_updated_storage(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_storage,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock(return_value=[ModelActions.DESTROY.value])
        mock_storage_service.patch_action_storage = AsyncMock(return_value=mocked_storage)
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            STORAGE_ACTION_MUTATION,
            variable_values={
                "id": str(storage_id),
                "input": {
                    "action": ModelActions.DESTROY.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["storageAction"]["id"] == str(mocked_storage.id)
        assert result.data["storageAction"]["name"] == mocked_storage.name
        assert result.data["storageAction"]["state"] is not None
        mock_storage_service.get_actions.assert_awaited_once_with(storage_id=storage_id, requester=mocked_user)
        mock_storage_service.patch_action_storage.assert_awaited_once()
        assert mock_storage_service.patch_action_storage.await_args
        call_kwargs = mock_storage_service.patch_action_storage.await_args.kwargs
        assert call_kwargs["storage_id"] == str(storage_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.DESTROY.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_delete_storage_denies_without_delete_action(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock(return_value=[])
        mock_storage_service.delete = AsyncMock()
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            DELETE_STORAGE_MUTATION,
            variable_values={"id": str(storage_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteStorage"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_storage_service.get_actions.assert_awaited_once_with(storage_id=storage_id, requester=mocked_user)
        mock_storage_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.storage.mutations.get_storage_service")
    async def test_delete_storage_returns_true(
        self,
        mock_get_service,
        mock_storage_service,
        mocked_user,
    ):
        storage_id = uuid4()
        mock_storage_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_storage_service.delete = AsyncMock()
        mock_get_service.return_value = mock_storage_service

        result = await schema.execute(
            DELETE_STORAGE_MUTATION,
            variable_values={"id": str(storage_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteStorage": True}
        mock_storage_service.get_actions.assert_awaited_once_with(storage_id=storage_id, requester=mocked_user)
        mock_storage_service.delete.assert_awaited_once_with(storage_id=str(storage_id), requester=mocked_user)
