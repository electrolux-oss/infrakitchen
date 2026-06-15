from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_SOURCE_CODE_MUTATION = """
    mutation CreateSourceCode($input: SourceCodeCreateInput!) {
        createSourceCode(input: $input) {
            id
            sourceCodeUrl
        }
    }
"""

UPDATE_SOURCE_CODE_MUTATION = """
    mutation UpdateSourceCode($id: UUID!, $input: SourceCodeUpdateInput!) {
        updateSourceCode(id: $id, input: $input) {
            id
            sourceCodeUrl
        }
    }
"""

SOURCE_CODE_ACTION_MUTATION = """
    mutation SourceCodeAction($id: UUID!, $input: SourceCodeActionInput!) {
        sourceCodeAction(id: $id, input: $input) {
            id
            sourceCodeUrl
        }
    }
"""

DELETE_SOURCE_CODE_MUTATION = """
    mutation DeleteSourceCode($id: UUID!) {
        deleteSourceCode(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestSourceCodeMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_create_source_code_returns_created_source_code(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_source_code,
        mocked_user,
    ):
        mock_source_code_service.create_source_code = AsyncMock(return_value=mocked_source_code)
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            CREATE_SOURCE_CODE_MUTATION,
            variable_values={
                "input": {
                    "sourceCodeUrl": "source_code_url",
                    "sourceCodeProvider": "github",
                    "sourceCodeLanguage": "opentofu",
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["createSourceCode"] == {
            "id": str(mocked_source_code.id),
            "sourceCodeUrl": mocked_source_code.source_code_url,
        }
        mock_source_code_service.create_source_code.assert_awaited_once_with(source_code=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_create_source_code_requires_authentication(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        mock_source_code_service.create_source_code = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        request = Mock()
        request.state = SimpleNamespace(user=mocked_user)

        result = await schema.execute(
            CREATE_SOURCE_CODE_MUTATION,
            variable_values={
                "input": {
                    "sourceCodeUrl": "source_code_url",
                    "sourceCodeProvider": "github",
                    "sourceCodeLanguage": "opentofu",
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createSourceCode"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_source_code_service.create_source_code.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_update_source_code_denies_without_edit_action(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[])
        mock_source_code_service.update_source_code = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_MUTATION,
            variable_values={
                "id": str(source_code_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateSourceCode"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_source_code_service.get_actions.assert_awaited_once_with(
            source_code_id=source_code_id, requester=mocked_user
        )
        mock_source_code_service.update_source_code.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_update_source_code_returns_updated_source_code(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_source_code,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_source_code_service.update_source_code = AsyncMock(return_value=mocked_source_code)
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_MUTATION,
            variable_values={
                "id": str(source_code_id),
                "input": {
                    "description": "Updated description",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["updateSourceCode"] == {
            "id": str(mocked_source_code.id),
            "sourceCodeUrl": mocked_source_code.source_code_url,
        }
        mock_source_code_service.get_actions.assert_awaited_once_with(
            source_code_id=source_code_id, requester=mocked_user
        )
        mock_source_code_service.update_source_code.assert_awaited_once_with(
            source_code_id=str(source_code_id),
            source_code=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_update_source_code_null_labels_are_rejected(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_source_code_service.update_source_code = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            UPDATE_SOURCE_CODE_MUTATION,
            variable_values={
                "id": str(source_code_id),
                "input": {
                    "labels": None,
                },
            },
            context_value=make_context(mocked_user),
        )

        # `labels` is non-nullable on SourceCodeUpdate; an explicit null must be rejected
        # (mirroring REST/Pydantic) rather than silently dropped.
        assert result.data is None or result.data["updateSourceCode"] is None
        assert result.errors is not None
        assert any("list" in error.message.lower() for error in result.errors)
        mock_source_code_service.update_source_code.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_source_code_action_raises_on_invalid_action(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock()
        mock_source_code_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            SOURCE_CODE_ACTION_MUTATION,
            variable_values={
                "id": str(source_code_id),
                "input": {
                    "action": "unknown",
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["sourceCodeAction"] is None
        assert result.errors is not None
        assert any("Invalid action" in error.message for error in result.errors)
        mock_source_code_service.get_actions.assert_not_awaited()
        mock_source_code_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_source_code_action_denies_when_action_not_allowed(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[])
        mock_source_code_service.patch_action = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            SOURCE_CODE_ACTION_MUTATION,
            variable_values={
                "id": str(source_code_id),
                "input": {
                    "action": ModelActions.SYNC.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["sourceCodeAction"] is None
        assert result.errors is not None
        assert any("Access denied for action sync" in error.message for error in result.errors)
        mock_source_code_service.get_actions.assert_awaited_once_with(
            source_code_id=source_code_id, requester=mocked_user
        )
        mock_source_code_service.patch_action.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_source_code_action_returns_updated_source_code(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_source_code,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[ModelActions.SYNC.value])
        mock_source_code_service.patch_action = AsyncMock(return_value=mocked_source_code)
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            SOURCE_CODE_ACTION_MUTATION,
            variable_values={
                "id": str(source_code_id),
                "input": {
                    "action": ModelActions.SYNC.value,
                },
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data is not None
        assert result.data["sourceCodeAction"] == {
            "id": str(mocked_source_code.id),
            "sourceCodeUrl": mocked_source_code.source_code_url,
        }
        mock_source_code_service.get_actions.assert_awaited_once_with(
            source_code_id=source_code_id, requester=mocked_user
        )
        mock_source_code_service.patch_action.assert_awaited_once()
        assert mock_source_code_service.patch_action.await_args
        call_kwargs = mock_source_code_service.patch_action.await_args.kwargs
        assert call_kwargs["source_code_id"] == str(source_code_id)
        assert call_kwargs["requester"] == mocked_user
        assert call_kwargs["body"].action == ModelActions.SYNC.value

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_delete_source_code_denies_without_delete_action(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[])
        mock_source_code_service.delete = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            DELETE_SOURCE_CODE_MUTATION,
            variable_values={"id": str(source_code_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteSourceCode"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_source_code_service.get_actions.assert_awaited_once_with(
            source_code_id=source_code_id, requester=mocked_user
        )
        mock_source_code_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.source_code.mutations.get_source_code_service")
    async def test_delete_source_code_returns_true(
        self,
        mock_get_service,
        mock_source_code_service,
        mocked_user,
    ):
        source_code_id = uuid4()
        mock_source_code_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_source_code_service.delete = AsyncMock()
        mock_get_service.return_value = mock_source_code_service

        result = await schema.execute(
            DELETE_SOURCE_CODE_MUTATION,
            variable_values={"id": str(source_code_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteSourceCode": True}
        mock_source_code_service.get_actions.assert_awaited_once_with(
            source_code_id=source_code_id, requester=mocked_user
        )
        mock_source_code_service.delete.assert_awaited_once_with(
            source_code_id=str(source_code_id), requester=mocked_user
        )
