from types import SimpleNamespace
from unittest.mock import ANY, AsyncMock, Mock, patch
from uuid import uuid4

import pytest

from core.constants.model import ModelActions
from graphql_api.schema import schema

CREATE_WORKSPACE_MUTATION = """
    mutation CreateWorkspace($input: WorkspaceCreateInput!) {
        createWorkspace(input: $input) {
            id
            name
            entityName
        }
    }
"""

UPDATE_WORKSPACE_MUTATION = """
    mutation UpdateWorkspace($id: UUID!, $input: WorkspaceUpdateInput!) {
        updateWorkspace(id: $id, input: $input) {
            id
            name
            entityName
        }
    }
"""

DELETE_WORKSPACE_MUTATION = """
    mutation DeleteWorkspace($id: UUID!) {
        deleteWorkspace(id: $id)
    }
"""


def make_context(user):
    request = Mock()
    request.state = SimpleNamespace(user=user)
    return {"session": Mock(), "user": user, "request": request}


class TestWorkspaceMutations:
    @pytest.mark.asyncio
    @patch("graphql_api.modules.workspace.mutations.get_workspace_service")
    async def test_create_workspace_returns_created_workspace(
        self,
        mock_get_service,
        workspace,
        mocked_user,
    ):
        mock_service = Mock()
        mock_service.create_workspace = AsyncMock(return_value=workspace)
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            CREATE_WORKSPACE_MUTATION,
            variable_values={
                "input": {
                    "workspaceProvider": "github",
                    "integrationId": str(uuid4()),
                    "description": "Workspace description",
                    "labels": [],
                    "configuration": {
                        "workspace_provider": "github",
                        "name": "repo-name",
                        "html_url": "https://github.com/acme/repo-name",
                        "git_url": "git://github.com/acme/repo-name.git",
                        "ssh_url": "git@github.com:acme/repo-name.git",
                        "url": "https://api.github.com/repos/acme/repo-name",
                        "created_at": "2024-01-01T00:00:00Z",
                        "updated_at": "2024-01-02T00:00:00Z",
                        "pushed_at": "2024-01-03T00:00:00Z",
                        "description": "Repo description",
                        "owner": {"login": "acme"},
                        "id": 123,
                        "default_branch": "main",
                    },
                }
            },
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "createWorkspace": {
                "id": str(workspace.id),
                "name": workspace.name,
                "entityName": "workspace",
            }
        }
        mock_service.create_workspace.assert_awaited_once_with(workspace=ANY, requester=mocked_user)

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workspace.mutations.get_workspace_service")
    async def test_create_workspace_requires_authentication(
        self,
        mock_get_service,
    ):
        mock_service = Mock()
        mock_service.create_workspace = AsyncMock()
        mock_get_service.return_value = mock_service

        request = Mock()
        request.state = SimpleNamespace(user=None)

        result = await schema.execute(
            CREATE_WORKSPACE_MUTATION,
            variable_values={
                "input": {
                    "workspaceProvider": "terraform-enterprise",
                    "integrationId": str(uuid4()),
                    "description": "Workspace description",
                    "labels": [],
                    "configuration": {},
                }
            },
            context_value={"session": Mock(), "request": request},
        )

        assert result.data is None or result.data["createWorkspace"] is None
        assert result.errors is not None
        assert any("Not authenticated" in error.message for error in result.errors)
        mock_service.create_workspace.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workspace.mutations.get_workspace_service")
    async def test_update_workspace_denies_without_edit_action(
        self,
        mock_get_service,
        mocked_user,
    ):
        workspace_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[])
        mock_service.update_workspace = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_WORKSPACE_MUTATION,
            variable_values={"id": str(workspace_id), "input": {"name": "Updated Workspace"}},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["updateWorkspace"] is None
        assert result.errors is not None
        assert any("Access denied for action edit" in error.message for error in result.errors)
        mock_service.get_actions.assert_awaited_once_with(workspace_id=workspace_id, requester=mocked_user)
        mock_service.update_workspace.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workspace.mutations.get_workspace_service")
    async def test_update_workspace_returns_updated_workspace(
        self,
        mock_get_service,
        workspace,
        mocked_user,
    ):
        workspace_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.EDIT])
        mock_service.update_workspace = AsyncMock(return_value=workspace)
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            UPDATE_WORKSPACE_MUTATION,
            variable_values={"id": str(workspace_id), "input": {"name": "Updated Workspace"}},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {
            "updateWorkspace": {
                "id": str(workspace.id),
                "name": workspace.name,
                "entityName": "workspace",
            }
        }
        mock_service.get_actions.assert_awaited_once_with(workspace_id=workspace_id, requester=mocked_user)
        mock_service.update_workspace.assert_awaited_once_with(
            workspace_id=str(workspace_id),
            workspace=ANY,
            requester=mocked_user,
        )

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workspace.mutations.get_workspace_service")
    async def test_delete_workspace_denies_without_delete_action(
        self,
        mock_get_service,
        mocked_user,
    ):
        workspace_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[])
        mock_service.delete = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            DELETE_WORKSPACE_MUTATION,
            variable_values={"id": str(workspace_id)},
            context_value=make_context(mocked_user),
        )

        assert result.data is None or result.data["deleteWorkspace"] is None
        assert result.errors is not None
        assert any("Access denied for action delete" in error.message for error in result.errors)
        mock_service.delete.assert_not_awaited()

    @pytest.mark.asyncio
    @patch("graphql_api.modules.workspace.mutations.get_workspace_service")
    async def test_delete_workspace_returns_true(
        self,
        mock_get_service,
        mocked_user,
    ):
        workspace_id = uuid4()
        mock_service = Mock()
        mock_service.get_actions = AsyncMock(return_value=[ModelActions.DELETE])
        mock_service.delete = AsyncMock()
        mock_get_service.return_value = mock_service

        result = await schema.execute(
            DELETE_WORKSPACE_MUTATION,
            variable_values={"id": str(workspace_id)},
            context_value=make_context(mocked_user),
        )

        assert result.errors is None
        assert result.data == {"deleteWorkspace": True}
        mock_service.get_actions.assert_awaited_once_with(workspace_id=workspace_id, requester=mocked_user)
        mock_service.delete.assert_awaited_once_with(workspace_id=str(workspace_id))
