from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

from application.executors.functions import get_executor_actions, get_executor_permissions
from application.executors.schema import ExecutorCreate, ExecutorUpdate
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import AccessDenied, EntityNotFound, EntityWrongState


@pytest.fixture
def entity_permissions(monkeypatch):
    """Executor and project policies of the requester, patched where each is looked up."""
    permissions: dict[str, list[str]] = {"executor": [], "project": []}

    async def executor_permissions(_requester, _entity_id, entity_name):
        return permissions[entity_name]

    async def project_permissions(_requester, _entity_id, entity_name):
        return permissions[entity_name]

    monkeypatch.setattr("application.executors.functions.user_entity_permissions", executor_permissions)
    monkeypatch.setattr("application.projects.functions.user_entity_permissions", project_permissions)
    return permissions


class TestExecutorPermissions:
    async def test_without_project_only_executor_policies(self, entity_permissions, mock_user_dto):
        entity_permissions["executor"] = ["read"]
        entity_permissions["project"] = ["admin"]

        assert await get_executor_permissions(mock_user_dto, uuid4(), None) == ["read"]

    async def test_project_policies_are_merged(self, entity_permissions, mock_user_dto, mocked_project):
        entity_permissions["executor"] = ["read"]
        entity_permissions["project"] = ["write"]

        assert await get_executor_permissions(mock_user_dto, uuid4(), mocked_project) == ["read", "write"]

    async def test_project_owner_is_executor_admin(
        self, entity_permissions, mock_user_dto, mocked_project, mocked_user
    ):
        mocked_project.owners = [mocked_user]

        assert "admin" in await get_executor_permissions(mock_user_dto, uuid4(), mocked_project)

    async def test_executor_admin_is_not_downgraded(self, entity_permissions, mock_user_dto, mocked_project):
        entity_permissions["executor"] = ["admin"]
        entity_permissions["project"] = ["read"]

        assert "admin" in await get_executor_permissions(mock_user_dto, uuid4(), mocked_project)


class TestExecutorActionsFromProject:
    async def test_project_write_can_plan_and_apply(self, entity_permissions, mock_user_dto, mocked_project):
        entity_permissions["project"] = ["write"]

        actions = await get_executor_actions(
            mock_user_dto, uuid4(), ModelStatus.DONE, ModelState.PROVISIONED, mocked_project
        )

        assert ModelActions.EXECUTE in actions
        assert ModelActions.DRYRUN in actions
        assert ModelActions.EDIT not in actions

    async def test_project_admin_can_edit(self, entity_permissions, mock_user_dto, mocked_project):
        entity_permissions["project"] = ["admin"]

        actions = await get_executor_actions(
            mock_user_dto, uuid4(), ModelStatus.DONE, ModelState.PROVISIONED, mocked_project
        )

        assert ModelActions.EDIT in actions

    async def test_project_read_grants_no_actions(self, entity_permissions, mock_user_dto, mocked_project):
        entity_permissions["project"] = ["read"]

        assert (
            await get_executor_actions(mock_user_dto, uuid4(), ModelStatus.DONE, ModelState.PROVISIONED, mocked_project)
            == []
        )

    async def test_service_passes_the_executor_project(
        self,
        entity_permissions,
        mock_executor_service,
        mock_executor_crud,
        mocked_executor,
        mocked_project,
        mock_user_dto,
    ):
        entity_permissions["project"] = ["admin"]
        mocked_executor.state = ModelState.PROVISIONED
        mocked_executor.status = ModelStatus.DONE
        mocked_executor.project = mocked_project
        mock_executor_crud.get_by_id.return_value = mocked_executor

        actions = await mock_executor_service.get_actions(mocked_executor.id, mock_user_dto)

        assert ModelActions.EDIT in actions
        fields = mock_executor_crud.get_by_id.call_args.kwargs["fields"]
        assert fields["project"] == {"id": None, "owners": {"id": None}}


class TestAssignProject:
    @pytest.fixture
    def creatable(self, mock_source_code_crud, mock_storage_crud, mocked_source_code, mocked_storage):
        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_storage_crud.get_by_id.return_value = mocked_storage

    @pytest.fixture
    def editable_executor(self, mocked_executor, mock_executor_crud):
        mocked_executor.state = ModelState.PROVISIONED
        mocked_executor.status = ModelStatus.DONE
        mocked_executor.project_id = None
        mock_executor_crud.get_by_id.return_value = mocked_executor
        mock_executor_crud.refresh = AsyncMock()
        return mocked_executor

    def create_body(self, mocked_source_code, storage_response, project_id):
        return ExecutorCreate(
            name="executor-in-project",
            source_code_id=mocked_source_code.id,
            source_code_version="v1.0.0",
            storage_id=storage_response.id,
            storage_path="path/to/state",
            project_id=project_id,
        )

    async def test_create_in_writable_project(
        self,
        creatable,
        entity_permissions,
        mock_executor_service,
        mock_executor_crud,
        mock_project_crud,
        mocked_project,
        mocked_executor,
        mocked_source_code,
        storage_response,
        mocked_user_response,
    ):
        entity_permissions["project"] = ["write"]
        mock_project_crud.get_by_id.return_value = mocked_project
        mock_executor_crud.create.return_value = mocked_executor
        mock_executor_crud.get_by_id.return_value = mocked_executor

        _ = await mock_executor_service.create_executor(
            self.create_body(mocked_source_code, storage_response, mocked_project.id), mocked_user_response
        )

        assert mock_executor_crud.create.call_args.args[0]["project_id"] == mocked_project.id

    async def test_create_denied_without_project_write(
        self,
        creatable,
        entity_permissions,
        mock_executor_service,
        mock_executor_crud,
        mock_project_crud,
        mocked_project,
        mocked_source_code,
        storage_response,
        mocked_user_response,
    ):
        entity_permissions["project"] = ["read"]
        mock_project_crud.get_by_id.return_value = mocked_project

        with pytest.raises(AccessDenied):
            _ = await mock_executor_service.create_executor(
                self.create_body(mocked_source_code, storage_response, mocked_project.id), mocked_user_response
            )

        mock_executor_crud.create.assert_not_awaited()

    async def test_create_in_disabled_project_is_rejected(
        self,
        creatable,
        entity_permissions,
        mock_executor_service,
        mock_executor_crud,
        mock_project_crud,
        mocked_project,
        mocked_source_code,
        storage_response,
        mocked_user_response,
    ):
        entity_permissions["project"] = ["admin"]
        mocked_project.status = ModelStatus.DISABLED
        mock_project_crud.get_by_id.return_value = mocked_project

        with pytest.raises(EntityWrongState, match="Project is not enabled"):
            _ = await mock_executor_service.create_executor(
                self.create_body(mocked_source_code, storage_response, mocked_project.id), mocked_user_response
            )

        mock_executor_crud.create.assert_not_awaited()

    async def test_create_in_missing_project(
        self,
        creatable,
        mock_executor_service,
        mock_project_crud,
        mocked_source_code,
        storage_response,
        mocked_user_response,
    ):
        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Project not found"):
            _ = await mock_executor_service.create_executor(
                self.create_body(mocked_source_code, storage_response, uuid4()), mocked_user_response
            )

    async def test_update_assigns_project(
        self,
        editable_executor,
        entity_permissions,
        mock_executor_service,
        mock_executor_crud,
        mock_project_crud,
        mocked_project,
        mocked_user_response,
    ):
        entity_permissions["project"] = ["write"]
        mock_project_crud.get_by_id.return_value = mocked_project

        _ = await mock_executor_service.update_executor(
            str(editable_executor.id), ExecutorUpdate(project_id=mocked_project.id), mocked_user_response
        )

        assert mock_executor_crud.update.call_args.args[1] == {"project_id": mocked_project.id}

    async def test_update_none_detaches_project(
        self,
        editable_executor,
        mock_executor_service,
        mock_executor_crud,
        mock_project_crud,
        mocked_user_response,
    ):
        editable_executor.project_id = uuid4()

        _ = await mock_executor_service.update_executor(
            str(editable_executor.id), ExecutorUpdate(project_id=None), mocked_user_response
        )

        assert mock_executor_crud.update.call_args.args[1] == {"project_id": None}
        mock_project_crud.get_by_id.assert_not_awaited()

    def test_update_without_project_keeps_it_unset(self):
        assert "project_id" not in ExecutorUpdate(description="new").model_fields_set


class TestEntityPermissionsWithProject:
    """userEntityPermissions (used by the UI) includes what executors and resources inherit from their project."""

    @pytest.fixture
    def lookups(self, monkeypatch, entity_permissions, mocked_project):
        async def own_permissions(_requester, _entity_id, entity_name):
            return entity_permissions[entity_name]

        get_project = AsyncMock(return_value=mocked_project)
        monkeypatch.setattr("application.common.entity_permissions.user_entity_permissions", own_permissions)
        monkeypatch.setattr("application.common.entity_permissions.get_entity_project", get_project)
        return get_project

    async def test_executor_gets_project_permissions(self, lookups, entity_permissions, mock_user_dto):
        from application.common.entity_permissions import entity_permissions_with_project

        entity_permissions["executor"] = ["read"]
        entity_permissions["project"] = ["read", "write"]

        assert await entity_permissions_with_project(AsyncMock(), mock_user_dto, "executor", uuid4()) == [
            "read",
            "write",
        ]

    async def test_executor_admin_skips_project_lookup(self, lookups, entity_permissions, mock_user_dto):
        from application.common.entity_permissions import entity_permissions_with_project

        entity_permissions["executor"] = ["read", "write", "admin"]

        assert "admin" in await entity_permissions_with_project(AsyncMock(), mock_user_dto, "executor", uuid4())
        lookups.assert_not_awaited()

    async def test_other_entities_ignore_projects(self, lookups, entity_permissions, mock_user_dto):
        from application.common.entity_permissions import entity_permissions_with_project

        entity_permissions["integration"] = ["read"]
        entity_permissions["project"] = ["admin"]

        assert await entity_permissions_with_project(AsyncMock(), mock_user_dto, "integration", uuid4()) == ["read"]
        lookups.assert_not_awaited()

    async def test_executor_without_project(self, lookups, entity_permissions, mock_user_dto):
        from application.common.entity_permissions import entity_permissions_with_project

        lookups.return_value = None
        entity_permissions["executor"] = ["read"]
        entity_permissions["project"] = ["admin"]

        assert await entity_permissions_with_project(AsyncMock(), mock_user_dto, "executor", uuid4()) == ["read"]
