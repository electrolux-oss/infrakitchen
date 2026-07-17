import pytest
from unittest.mock import ANY, AsyncMock, Mock
from uuid import uuid4

from application.projects.model import Project
from application.projects.schema import ProjectCreate, ProjectResponse, ProjectUpdate
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.permissions.model import Permission
from core.permissions.schema import EntityPolicyCreate

PROJECT_ID = "abc123"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_project_service, mock_project_crud):
        mock_project_crud.get_by_id.return_value = None

        result = await mock_project_service.get_by_id("invalid_id")

        assert result is None
        mock_project_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_project_service, mock_project_crud, monkeypatch, mocked_project, project_response
    ):
        mock_project_crud.get_by_id.return_value = mocked_project
        mocked_validate = Mock(return_value=project_response)
        monkeypatch.setattr(ProjectResponse, "model_validate", mocked_validate)

        result = await mock_project_service.get_by_id(PROJECT_ID)

        assert result.name == mocked_project.name
        mock_project_crud.get_by_id.assert_awaited_once_with(PROJECT_ID)
        mocked_validate.assert_called_once_with(mocked_project)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_project_service, mock_project_crud):
        mock_project_crud.get_all.return_value = []

        result = await mock_project_service.get_all(limit=10)

        assert result == []
        mock_project_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_project_service, mock_project_crud, monkeypatch):
        project_1 = Project(id=uuid4(), name="Test Project 1")
        project_2 = Project(id=uuid4(), name="Test Project 2")
        projects = [project_1, project_2]
        mock_project_crud.get_all.return_value = projects

        project_response_1 = ProjectResponse(id=project_1.id, name="Test Project 1")
        project_response_2 = ProjectResponse(id=project_2.id, name="Test Project 2")

        def mock_model_validate_validate(arg):
            return project_response_1 if arg.id == project_1.id else project_response_2

        monkeypatch.setattr(ProjectResponse, "model_validate", mock_model_validate_validate)

        result = await mock_project_service.get_all(limit=10, offset=0)

        assert result == [project_response_1, project_response_2]
        mock_project_crud.get_all.assert_awaited_once_with(limit=10, offset=0)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_project_service, mock_project_crud):
        mock_project_crud.count.return_value = 1

        result = await mock_project_service.count(filter={"key": "value"})

        assert result == 1
        mock_project_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_project_service,
        mock_project_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_project,
        mocked_user,
    ):
        project_create = ProjectCreate(
            name="Test Project",
            description="Short description",
            labels=["label-1"],
        )
        requester = mocked_user
        expected_created_project = mocked_project
        expected_created_project.id = uuid4()
        expected_created_project.name = "Test Project"
        expected_created_project.description = "Short description"
        expected_created_project.labels = ["label-1"]
        expected_created_project.created_by = requester.id

        mock_project_crud.create.return_value = expected_created_project
        mock_project_crud.get_by_id.return_value = expected_created_project

        result = await mock_project_service.create_project(project_create, requester)

        mock_project_crud.create.assert_awaited_once_with(
            {
                **project_create.model_dump(exclude_unset=True),
                "created_by": requester.id,
            }
        )
        assert result.status == ModelStatus.ENABLED
        mock_revision_handler.handle_revision.assert_awaited_once_with(expected_created_project)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            expected_created_project.id,
            requester.id,
            ModelActions.CREATE,
            revision_number=expected_created_project.revision_number,
        )
        mock_event_sender.send_event.assert_awaited_once_with(ANY, ModelActions.CREATE)
        assert result.description == "Short description"
        assert result.labels == ["label-1"]

    @pytest.mark.asyncio
    async def test_create_error(self, mock_project_service, mock_project_crud, mocked_user):
        project_create = Mock(spec=ProjectCreate)
        project_create.model_dump = Mock(return_value={})

        error = RuntimeError("create fail")
        mock_project_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_project_service.create_project(project_create, mocked_user)

        assert exc.value is error
        project_create.model_dump.assert_called_once_with(exclude_unset=True)
        mock_project_crud.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_project_not_found_after_creation(
        self, mock_project_service, mock_project_crud, mocked_project, mocked_user
    ):
        project_create = ProjectCreate(name="Test Project")
        mock_project_crud.create.return_value = mocked_project
        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Project not found after creation"):
            await mock_project_service.create_project(project_create, mocked_user)


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_project_service,
        mock_project_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_project,
        mocked_user,
    ):
        project_update = ProjectUpdate(name="Test Project Updated", description="Project description")
        project_update_body = {
            "name": "Test Project Updated",
            "description": "Project description",
        }
        project_id = mocked_project.id
        existing_project = mocked_project
        updated_project = mocked_project
        updated_project.name = "Test Project Updated"

        mock_project_crud.get_by_id.return_value = existing_project
        mock_project_crud.update.return_value = updated_project

        result = await mock_project_service.update_project(
            project_id=project_id, project=project_update, requester=mocked_user
        )

        mock_project_crud.get_by_id.assert_awaited_once_with(project_id)
        mock_project_crud.update.assert_awaited_once_with(existing_project, project_update_body)
        mock_project_crud.refresh.assert_awaited_once_with(existing_project)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            updated_project.id,
            mocked_user.id,
            ModelActions.UPDATE,
            revision_number=existing_project.revision_number,
        )
        mock_event_sender.send_event.assert_awaited_once_with(ANY, ModelActions.UPDATE)
        assert result.name == "Test Project Updated"

    @pytest.mark.asyncio
    async def test_update_project_does_not_exist(self, mock_project_service, mock_project_crud, mocked_user):
        project_update = Mock(spec=ProjectUpdate)

        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Project not found"):
            await mock_project_service.update_project(
                project_id=PROJECT_ID, project=project_update, requester=mocked_user
            )

    @pytest.mark.asyncio
    async def test_update_project_no_changes_raises(
        self, mock_project_service, mock_project_crud, mocked_project, mocked_user
    ):
        project_update = ProjectUpdate(name=mocked_project.name)

        mock_project_crud.get_by_id.return_value = mocked_project

        with pytest.raises(ValueError, match="No changes detected"):
            await mock_project_service.update_project(
                project_id=mocked_project.id, project=project_update, requester=mocked_user
            )

        mock_project_crud.update.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_update_disabled_project_enables_it(
        self, mock_project_service, mock_project_crud, mocked_project, mocked_user
    ):
        project_update = ProjectUpdate(name="Test Project Updated")
        mocked_project.status = ModelStatus.DISABLED
        mock_project_crud.get_by_id.return_value = mocked_project

        result = await mock_project_service.update_project(
            project_id=mocked_project.id, project=project_update, requester=mocked_user
        )

        assert result.status == ModelStatus.ENABLED


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_success_with_status_disable(
        self, mock_project_service, mock_project_crud, mock_audit_log_handler, mock_event_sender, monkeypatch
    ):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        existing_project = Project(
            id=uuid4(),
            name="Test Project",
            status=ModelStatus.ENABLED,
        )
        project_response = ProjectResponse(id=existing_project.id, name="Test Project", status=ModelStatus.DISABLED)

        mock_project_crud.get_by_id.return_value = existing_project
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(ProjectResponse, "model_validate", Mock(return_value=project_response))

        result = await mock_project_service.patch_action(project_id=PROJECT_ID, body=patch_body, requester=requester)

        mock_project_crud.get_by_id.assert_awaited_once_with(PROJECT_ID)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_project.id, requester.id, ModelActions.DISABLE, revision_number=existing_project.revision_number
        )
        response = ProjectResponse.model_validate(existing_project)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DISABLE)
        assert result.status == ModelStatus.DISABLED

    @pytest.mark.asyncio
    async def test_patch_success_with_status_enable(
        self, mock_project_service, mock_project_crud, mock_audit_log_handler, mock_event_sender, monkeypatch
    ):
        patch_body = PatchBodyModel(action=ModelActions.ENABLE)
        existing_project = Project(
            id=uuid4(),
            name="Test Project",
            status=ModelStatus.DISABLED,
        )
        project_response = ProjectResponse(id=existing_project.id, name="Test Project", status=ModelStatus.ENABLED)

        mock_project_crud.get_by_id.return_value = existing_project
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        monkeypatch.setattr(ProjectResponse, "model_validate", Mock(return_value=project_response))

        result = await mock_project_service.patch_action(project_id=PROJECT_ID, body=patch_body, requester=requester)

        mock_project_crud.get_by_id.assert_awaited_once_with(PROJECT_ID)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_project.id, requester.id, ModelActions.ENABLE, revision_number=existing_project.revision_number
        )
        response = ProjectResponse.model_validate(existing_project)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.ENABLE)
        assert result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_patch_project_already_enabled(
        self, mock_project_service, mock_project_crud, mocked_project, mocked_user
    ):
        patch_body = PatchBodyModel(action=ModelActions.ENABLE)
        mock_project_crud.get_by_id.return_value = mocked_project

        with pytest.raises(EntityWrongState, match="Project is already enabled"):
            await mock_project_service.patch_action(project_id=PROJECT_ID, body=patch_body, requester=mocked_user)

    @pytest.mark.asyncio
    async def test_patch_project_does_not_exist(self, mock_project_service, mock_project_crud):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        requester = Mock(spec=UserDTO)

        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Project not found"):
            await mock_project_service.patch_action(project_id=PROJECT_ID, body=patch_body, requester=requester)


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_project_service,
        mock_project_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_user_dto,
    ):
        existing_project = Project(
            id=uuid4(),
            name="Test Project",
            status=ModelStatus.DISABLED,
        )
        mock_project_crud.get_by_id.return_value = existing_project
        mock_result = Mock()
        mock_result.all.return_value = []
        mock_project_crud.session.execute.return_value = mock_result

        await mock_project_service.delete(project_id=existing_project.id, requester=mock_user_dto)

        mock_project_crud.get_by_id.assert_awaited_once_with(existing_project.id)
        mock_project_crud.session.execute.assert_awaited_once()
        mock_project_crud.delete.assert_awaited_once_with(existing_project)
        mock_revision_handler.delete_revisions.assert_awaited_once_with(existing_project.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_project.id, mock_user_dto.id, ModelActions.DELETE
        )

    @pytest.mark.asyncio
    async def test_delete_error_has_assigned_resources(
        self,
        mock_project_service,
        mock_project_crud,
        mocked_project,
        mocked_user,
        mock_revision_handler,
        mock_audit_log_handler,
    ):
        mocked_project.status = ModelStatus.DISABLED
        mock_project_crud.get_by_id.return_value = mocked_project
        resource_id = uuid4()
        mock_result = Mock()
        mock_result.all.return_value = [(resource_id, "Resource 1")]
        mock_project_crud.session.execute.return_value = mock_result

        with pytest.raises(DependencyError) as exc:
            await mock_project_service.delete(project_id=mocked_project.id, requester=mocked_user)

        assert str(exc.value) == "Cannot delete project, it has 1 assigned resources"
        assert exc.value.metadata == [{"id": str(resource_id), "name": "Resource 1", "entityName": "resource"}]
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_project_must_be_disabled(
        self, mock_project_service, mock_project_crud, mocked_project, mocked_user
    ):
        mocked_project.status = ModelStatus.ENABLED
        mock_project_crud.get_by_id.return_value = mocked_project

        with pytest.raises(EntityWrongState, match="Project must be disabled before deletion"):
            await mock_project_service.delete(project_id=mocked_project.id, requester=mocked_user)

    @pytest.mark.asyncio
    async def test_delete_project_does_not_exist(
        self, mock_project_service, mock_project_crud, mock_revision_handler, mock_audit_log_handler
    ):
        requester = Mock(spec=UserDTO)

        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Project not found"):
            await mock_project_service.delete(project_id=PROJECT_ID, requester=requester)
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()


class TestGetActions:
    @pytest.mark.asyncio
    async def test_get_actions_success(
        self, mock_project_service, mock_project_crud, mocked_project, mocked_user, monkeypatch
    ):
        expected_actions = [ModelActions.EDIT, ModelActions.DISABLE]
        mock_project_crud.get_by_id.return_value = mocked_project
        mocked_get_actions = AsyncMock(return_value=expected_actions)
        monkeypatch.setattr("application.projects.service.get_project_actions", mocked_get_actions)

        result = await mock_project_service.get_actions(project_id=mocked_project.id, requester=mocked_user)

        assert result == expected_actions
        mock_project_crud.get_by_id.assert_awaited_once_with(
            mocked_project.id, fields={"status": None, "owners": {"id": None}}
        )
        mocked_get_actions.assert_awaited_once_with(
            mocked_user, mocked_project.id, mocked_project.status, mocked_project
        )

    @pytest.mark.asyncio
    async def test_get_actions_project_not_found(self, mock_project_service, mock_project_crud, mocked_user):
        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Project not found"):
            await mock_project_service.get_actions(project_id=PROJECT_ID, requester=mocked_user)


class TestCreateProjectPolicy:
    @pytest.mark.asyncio
    async def test_create_project_policy_success(
        self, mock_project_service, mock_project_crud, mock_permission_service, mocked_project, mocked_user
    ):
        project_policy = EntityPolicyCreate(
            role="project_admin",
            entity_id=mocked_project.id,
            entity_name="project",
            action="admin",
        )
        permission = Permission(id=uuid4(), ptype="p", v0="project_admin", v1="project:entity", v2="admin")
        mock_project_crud.get_by_id.return_value = mocked_project
        mock_permission_service.create_entity_policy = AsyncMock(return_value=permission)
        mock_permission_service.casbin_enforcer.send_reload_event = AsyncMock()

        result = await mock_project_service.create_project_policy(project_policy=project_policy, requester=mocked_user)

        assert result == [permission]
        mock_project_crud.get_by_id.assert_awaited_once_with(mocked_project.id)
        mock_permission_service.create_entity_policy.assert_awaited_once_with(
            project_policy,
            mocked_user,
            reload_permission=False,
        )
        mock_permission_service.casbin_enforcer.send_reload_event.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_project_policy_project_not_found(self, mock_project_service, mock_project_crud, mocked_user):
        project_id = uuid4()
        project_policy = EntityPolicyCreate(
            role="project_admin",
            entity_id=project_id,
            entity_name="project",
            action="admin",
        )
        mock_project_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match=f"Project {project_id} not found"):
            await mock_project_service.create_project_policy(project_policy=project_policy, requester=mocked_user)
