import pytest
from unittest.mock import Mock

from pydantic import PydanticUserError
from uuid import uuid4

from application.workspaces.model import Workspace
from application.workspaces.schema import WorkspaceResponse, WorkspaceCreate, WorkspaceUpdate
from core import UserDTO
from core.constants import ModelState
from core.constants.model import ModelActions
from core.errors import EntityNotFound
from core.utils.model_tools import model_db_dump

WORKSPACE_ID = "abc123"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_workspace_service, mock_workspace_crud):
        mock_workspace_crud.get_by_id.return_value = None

        result = await mock_workspace_service.get_by_id("invalid_id")

        assert result is None
        mock_workspace_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_workspace_service, mock_workspace_crud, monkeypatch, workspace, workspace_response
    ):
        mock_workspace_crud.get_by_id.return_value = workspace
        mocked_validate = Mock(return_value=workspace_response)
        monkeypatch.setattr(WorkspaceResponse, "model_validate", mocked_validate)

        result = await mock_workspace_service.get_by_id(WORKSPACE_ID)

        assert result.name == workspace.name

        mock_workspace_crud.get_by_id.assert_awaited_once_with(WORKSPACE_ID)
        mocked_validate.assert_called_once_with(workspace)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_workspace_service, mock_workspace_crud, monkeypatch, workspace):
        mock_workspace_crud.get_by_id.return_value = workspace

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(WorkspaceResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_workspace_service.get_by_id(WORKSPACE_ID)

        assert exc.value is error
        mock_workspace_crud.get_by_id.assert_awaited_once_with(WORKSPACE_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_workspace_service, mock_workspace_crud):
        mock_workspace_crud.get_all.return_value = []

        result = await mock_workspace_service.get_all(limit=10)

        assert result == []
        mock_workspace_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_workspace_service,
        mock_workspace_crud,
        monkeypatch,
        workspace,
        mocked_user_response,
        mocked_integration_response,
    ):
        workspace1 = workspace
        workspace2 = workspace
        workspace2.id = uuid4()
        workspaces = [workspace1, workspace2]
        mock_workspace_crud.get_all.return_value = workspaces

        workspace_response_1 = WorkspaceResponse(
            id=workspace1.id,
            name=workspace1.name,
            workspace_provider=workspace1.workspace_provider,
            creator=mocked_user_response,
            integration=mocked_integration_response,
            configuration=workspace1.configuration,
        )
        workspace_response_2 = WorkspaceResponse(
            id=workspace2.id,
            name=workspace2.name,
            workspace_provider=workspace2.workspace_provider,
            creator=mocked_user_response,
            integration=mocked_integration_response,
            configuration=workspace2.configuration,
        )

        def mock_model_validate_validate(arg):
            return workspace_response_1 if arg.id == workspace1.id else workspace_response_2

        monkeypatch.setattr(WorkspaceResponse, "model_validate", mock_model_validate_validate)

        result = await mock_workspace_service.get_all(limit=10, offset=0)

        assert result[0].name == workspace1.name
        assert result[1].name == workspace2.name
        mock_workspace_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_workspace_service, mock_workspace_crud, monkeypatch, workspace):
        mock_workspace_crud.get_all.return_value = [workspace]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(WorkspaceResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_workspace_service.get_all(limit=10)

        assert exc.value is error
        mock_workspace_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_workspace_service, mock_workspace_crud):
        mock_workspace_crud.count.return_value = 1

        result = await mock_workspace_service.count(filter={"key": "value"})

        assert result == 1

        mock_workspace_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_workspace_service, mock_workspace_crud):
        error = RuntimeError("db failure")
        mock_workspace_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workspace_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_workspace_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success_with_github(
        self,
        mock_workspace_service,
        mock_workspace_crud,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        workspace,
        workspace_response,
    ):
        workspace_body = {
            "description": "New description",
            "workspace_provider": "github",
            "integration_id": str(uuid4()),
            "labels": [],
            "configuration": {
                "id": 123456,
                "name": "TestWorkspace",
                "html_url": "http://example.com",
                "git_url": "http://git.example.com",
                "ssh_url": "ssh://example.com",
                "clone_url": "http://clone.example.com",
                "url": "http://url.example.com",
                "created_at": "2023-10-01T00:00:00Z",
                "updated_at": "2023-10-01T01:00:00Z",
                "pushed_at": None,
                "description": "Test description",
                "workspace_provider": "github",
                "default_branch": "main",
                "owner": {
                    "login": "test_owner",
                },
            },
        }
        workspace_create = WorkspaceCreate.model_validate(workspace_body)

        expected_workspace_configuration = {
            "name": "TestWorkspace",
            "url": "http://url.example.com/",
            "description": "Test description",
            "ssh_url": "ssh://example.com",
            "https_url": "http://example.com/",
            "default_branch": "main",
            "organization": "test_owner",
        }

        expected_workspace_body = model_db_dump(workspace_create)
        expected_workspace_body["created_by"] = "user1"
        expected_workspace_body["name"] = workspace_create.configuration.name
        expected_workspace_body["configuration"] = expected_workspace_configuration
        requester = Mock(spec=UserDTO)
        requester.id = "user1"

        new_workspace = Workspace(
            name="Test Workspace",
            workspace_provider="github",
            configuration=expected_workspace_configuration,
        )
        mock_workspace_crud.create.return_value = new_workspace
        mock_workspace_crud.get_by_id.return_value = workspace

        monkeypatch.setattr(WorkspaceResponse, "model_validate", Mock(return_value=workspace_response))

        result = await mock_workspace_service.create(workspace_create, requester)

        mock_workspace_crud.create.assert_awaited_once_with(expected_workspace_body)

        mock_audit_log_handler.create_log.assert_awaited_once_with(new_workspace.id, requester.id, "create")
        response = WorkspaceResponse.model_validate(new_workspace)
        mock_event_sender.send_event.assert_awaited_once_with(response, "create")

        assert result.id == workspace_response.id

    @pytest.mark.asyncio
    async def test_create_success_with_bitbucket(
        self,
        mock_workspace_service,
        mock_workspace_crud,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        workspace,
        workspace_response,
    ):
        workspace_body = {
            "description": "New description",
            "workspace_provider": "bitbucket",
            "integration_id": str(uuid4()),
            "labels": [],
            "configuration": {
                "workspace_provider": "bitbucket",
                "type": "repository",
                "full_name": "org/ik-workspace",
                "links": {
                    "html": {"href": "https://example.org/org/ik-workspace"},
                    "clone": [
                        {
                            "name": "https",
                            "href": "https://user_name@example.org/org/ik-workspace.git",
                        },
                        {"name": "ssh", "href": "git@example.org:org/ik-workspace.git"},
                    ],
                },
                "name": "ik-workspace",
                "slug": "ik-workspace",
                "description": "test description",
                "workspace": {
                    "type": "workspace",
                    "uuid": "901fd2d4-a91a-41af-9995-385d98b99f9c",
                    "name": "dx-electrolux",
                    "slug": "org",
                    "links": {
                        "html": {"href": "https://example.org/org/"},
                    },
                },
                "created_on": "2025-06-24T19:32:04.534982Z",
                "updated_on": "2025-06-24T19:32:06.618440Z",
                "uuid": "f7804ad7-e31f-427e-8f1c-e2220170eb26",
                "mainbranch": {"name": "develop", "type": "branch"},
            },
        }

        workspace_create = WorkspaceCreate.model_validate(workspace_body)

        expected_workspace_configuration = {
            "name": "ik-workspace",
            "url": "https://example.org/org/ik-workspace",
            "description": "test description",
            "ssh_url": "git@example.org:org/ik-workspace.git",
            "https_url": "https://example.org/org/ik-workspace.git",
            "default_branch": "develop",
            "organization": "org",
        }

        expected_workspace_body = model_db_dump(workspace_create)
        expected_workspace_body["created_by"] = "user1"
        expected_workspace_body["name"] = workspace_create.configuration.name
        expected_workspace_body["configuration"] = expected_workspace_configuration
        requester = Mock(spec=UserDTO)
        requester.id = "user1"

        new_workspace = Workspace(
            name="Test Workspace",
            workspace_provider="github",
            configuration=expected_workspace_configuration,
        )
        mock_workspace_crud.create.return_value = new_workspace
        mock_workspace_crud.get_by_id.return_value = workspace

        monkeypatch.setattr(WorkspaceResponse, "model_validate", Mock(return_value=workspace_response))

        result = await mock_workspace_service.create(workspace_create, requester)

        mock_workspace_crud.create.assert_awaited_once_with(expected_workspace_body)

        mock_audit_log_handler.create_log.assert_awaited_once_with(new_workspace.id, requester.id, "create")
        response = WorkspaceResponse.model_validate(new_workspace)
        mock_event_sender.send_event.assert_awaited_once_with(response, "create")

        assert result.id == workspace_response.id

    @pytest.mark.asyncio
    async def test_create_error(self, mock_workspace_service, mock_workspace_crud):
        workspace_body = {
            "description": "New description",
            "workspace_provider": "github",
            "integration_id": str(uuid4()),
            "labels": [],
            "configuration": {
                "id": 123456,
                "name": "TestWorkspace",
                "html_url": "http://example.com",
                "git_url": "http://git.example.com",
                "ssh_url": "ssh://example.com",
                "clone_url": "http://clone.example.com",
                "url": "http://url.example.com",
                "created_at": "2023-10-01T00:00:00Z",
                "updated_at": "2023-10-01T01:00:00Z",
                "pushed_at": None,
                "description": "Test description",
                "workspace_provider": "github",
                "default_branch": "main",
                "owner": {
                    "login": "test_owner",
                },
            },
        }

        workspace_create = WorkspaceCreate.model_validate(workspace_body)

        requester = Mock(spec=UserDTO)
        requester.id = "user1"

        error = RuntimeError("create fail")
        mock_workspace_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workspace_service.create(workspace_create, requester)

        assert exc.value is error
        mock_workspace_crud.create.assert_awaited_once()


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_workspace_service,
        mock_workspace_crud,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        workspace,
        workspace_response,
    ):
        workspace_update = Mock(spec=WorkspaceUpdate)
        workspace_update_body = {"name": "Test Workspace Updated", "description": "Workspace description"}
        workspace_id = uuid4()
        existing_workspace = workspace
        existing_workspace.id = workspace_id
        existing_workspace.state = ModelState.PROVISIONED

        updated_workspace = Workspace(
            id=workspace_id,
            name="Test Workspace Updated",
        )
        workspace_response_with_update = workspace_response
        workspace_response_with_update.id = workspace_id

        workspace_update.model_dump = Mock(return_value=workspace_update_body)
        mock_workspace_crud.get_by_id.return_value = existing_workspace
        mock_workspace_crud.update.return_value = updated_workspace
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(WorkspaceResponse, "model_validate", Mock(return_value=workspace_response))

        result = await mock_workspace_service.update(
            workspace_id=workspace_id, workspace=workspace_update, requester=requester
        )
        assert result.id == workspace_response_with_update.id
        assert result.name == workspace_response_with_update.name

        workspace_update.model_dump.assert_called_once_with(exclude_unset=True)
        mock_workspace_crud.get_by_id.assert_awaited_once_with(workspace_id)
        mock_workspace_crud.update.assert_awaited_once_with(existing_workspace, workspace_update_body)

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            updated_workspace.id, requester.id, ModelActions.UPDATE
        )
        response = WorkspaceResponse.model_validate(updated_workspace)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.UPDATE)

    @pytest.mark.asyncio
    async def test_update_error(self, mock_workspace_service, mock_workspace_crud):
        workspace_update = Mock(spec=WorkspaceUpdate)
        requester = Mock(spec=UserDTO)
        existing_workspace = Workspace(id=uuid4(), name="Test Workspace")
        mock_workspace_crud.get_by_id.return_value = existing_workspace

        error = RuntimeError("update fail")
        mock_workspace_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_workspace_service.update(
                workspace_id=WORKSPACE_ID, workspace=workspace_update, requester=requester
            )

        assert exc.value is error


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, mock_workspace_service, mock_workspace_crud):
        workspace_id = uuid4()
        existing_workspace = Workspace(
            id=workspace_id,
            name="Test Workspace",
        )
        mock_workspace_crud.get_by_id.return_value = existing_workspace
        mock_workspace_crud.get_dependencies.return_value = []

        await mock_workspace_service.delete(workspace_id=workspace_id)

        mock_workspace_crud.get_by_id.assert_awaited_once_with(workspace_id)
        mock_workspace_crud.delete.assert_awaited_once_with(existing_workspace)

    @pytest.mark.asyncio
    async def test_delete_workspace_does_not_exist(self, mock_workspace_service, mock_workspace_crud):
        mock_workspace_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Workspace not found"):
            await mock_workspace_service.delete(workspace_id=WORKSPACE_ID)
