from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from pydantic.errors import PydanticUserError

from application.resources.model import Resource
from application.resources.schema import (
    ResourceResponse,
    ResourceWithConfigs,
    ResourceCreate,
)
from application.resources.service import ResourceService
from core.config import InfrakitchenConfig
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import EntityNotFound, EntityWrongState
from core.users.model import UserDTO

RESOURCE_ID = "abc123"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_resource_service):
        mock_resource_service.crud.get_by_id.return_value = None

        with pytest.raises(ValueError) as exc:
            await mock_resource_service.get_by_id("invalid_id")
        assert str(exc.value) == "Invalid resource ID: invalid_id"

    @pytest.mark.asyncio
    async def test_get_by_id_success(self, monkeypatch, mock_resource_service, resource_response, mocked_resource):
        mock_resource_service.crud.get_by_id.return_value = mocked_resource
        mocked_validate = Mock(return_value=resource_response)
        monkeypatch.setattr(ResourceResponse, "model_validate", mocked_validate)

        result = await mock_resource_service.get_by_id(resource_response.id)

        assert result.id == resource_response.id
        assert result.name == resource_response.name
        assert result.template == resource_response.template
        assert result.source_code_version == resource_response.source_code_version
        assert result.storage == resource_response.storage
        assert result.integration_ids == resource_response.integration_ids
        assert result.variables == resource_response.variables

        mock_resource_service.crud.get_by_id.assert_awaited_once_with(resource_response.id)
        mocked_validate.assert_called_once_with(mocked_resource)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, monkeypatch, mock_resource_service, mocked_resource):
        mock_resource_service.crud.get_by_id.return_value = mocked_resource

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ResourceResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_resource_service.get_by_id(mocked_resource.id)

        assert exc.value is error
        mock_resource_service.crud.get_by_id.assert_awaited_once_with(mocked_resource.id)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_resource_service, mock_resource_crud):
        mock_resource_crud.get_all.return_value = []

        result = await mock_resource_service.get_all(limit=10)

        assert result == []
        mock_resource_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_resource_service,
        mock_resource_crud,
        monkeypatch,
        mocked_user_response,
        storage_response,
        template_response,
    ):
        resources = [
            Resource(
                id=uuid4(),
                name="Test Resource1",
                source_code_version=None,
                template={"id": uuid4(), "name": "template1"},
            ),
            Resource(id=uuid4(), name="Test Resource2", template="template2"),
        ]
        mock_resource_crud.get_all.return_value = resources

        resource_response_1 = ResourceResponse(
            id=uuid4(),
            name="Test Resource 1",
            template=template_response,
            creator=mocked_user_response,
            storage=storage_response,
            source_code_version=None,
        )
        resource_response_2 = ResourceResponse(
            id=uuid4(),
            name="Test Resource 2",
            template=template_response,
            creator=mocked_user_response,
            storage=storage_response,
            source_code_version=None,
        )

        def mock_model_validate_validate(arg):
            return resource_response_1 if arg.name == "Test Resource1" else resource_response_2

        monkeypatch.setattr(ResourceResponse, "model_validate", mock_model_validate_validate)

        result = await mock_resource_service.get_all(limit=10, offset=0)

        assert result == [resource_response_1, resource_response_2]
        mock_resource_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_resource_service, mock_resource_crud, monkeypatch, mocked_resource):
        mock_resource_crud.get_all.return_value = [mocked_resource]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(ResourceResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_resource_service.get_all(limit=10)

        assert exc.value is error
        mock_resource_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_resource_service, mock_resource_crud):
        mock_resource_crud.count.return_value = 1

        result = await mock_resource_service.count(filter={"key": "value"})

        assert result == 1

        mock_resource_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_resource_service, mock_resource_crud):
        error = RuntimeError("db failure")
        mock_resource_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_resource_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_resource_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "expected_state,expected_status, disabled_approval_flow_feature",
        [
            (ModelState.PROVISION, ModelStatus.APPROVAL_PENDING, False),
            (ModelState.PROVISION, ModelStatus.READY, True),
        ],
    )
    async def test_create_abstract_success(
        self,
        expected_state,
        expected_status,
        disabled_approval_flow_feature,
        mock_resource_service,
        mock_resource_crud,
        mock_template_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        template_response,
        mocked_resource,
        resource_response,
        mocked_user_response,
    ):
        if disabled_approval_flow_feature is True:
            InfrakitchenConfig().approval_flow = False

        template_response.abstract = True
        mocked_resource.abstract = True
        resource_response.abstract = True

        resource_create = ResourceCreate(
            name=mocked_resource.name,
            template_id=template_response.id,
        )

        expected_resource_body = {
            "name": mocked_resource.name,
            "template_id": template_response.id,
            "created_by": mocked_user_response.id,
            "abstract": True,
        }
        requester = mocked_user_response

        mock_template_crud.get_by_id.return_value = template_response

        new_resource = Resource(name=mocked_resource.name, template_id=template_response.id, created_by=requester.id)
        mock_resource_crud.create.return_value = new_resource
        mock_resource_crud.get_by_id.return_value = mocked_resource

        monkeypatch.setattr(ResourceResponse, "model_validate", Mock(return_value=resource_response))

        result = await mock_resource_service.create(resource_create, requester)

        mock_resource_crud.create.assert_awaited_once_with(expected_resource_body)

        assert new_resource.state == expected_state
        assert new_resource.status == expected_status

        mock_revision_handler.handle_revision.assert_awaited_once_with(new_resource)
        mock_audit_log_handler.create_log.assert_awaited_once_with(new_resource.id, requester.id, ModelActions.CREATE)
        response = ResourceResponse.model_validate(new_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.CREATE)

        assert result.template.id == template_response.id
        assert result.name == mocked_resource.name
        assert result.abstract is True
        InfrakitchenConfig().approval_flow = True

    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_resource_service,
        mock_resource_crud,
        mock_template_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_storage,
        mock_storage_crud,
        monkeypatch,
        template_response,
        mocked_resource,
        resource_response,
        mock_source_code_version_crud,
        source_code_version_response,
        storage_response,
        mocked_user_response,
    ):
        resource_create = ResourceCreate(
            name=mocked_resource.name,
            template_id=template_response.id,
            source_code_version_id=source_code_version_response.id,
            storage_id=storage_response.id,
            storage_path="path/to/storage",
        )

        expected_resource_body = {
            "name": mocked_resource.name,
            "template_id": template_response.id,
            "created_by": mocked_user_response.id,
            "source_code_version_id": source_code_version_response.id,
            "storage_id": storage_response.id,
            "storage_path": "path/to/storage",
            "variables": [],
        }
        requester = mocked_user_response

        mock_template_crud.get_by_id.return_value = template_response
        mock_storage_crud.get_by_id.return_value = mocked_storage
        mock_source_code_version_crud.get_by_id.return_value = source_code_version_response

        new_resource = Resource(name=mocked_resource.name, template_id=template_response.id, created_by=requester.id)
        mock_resource_crud.create.return_value = new_resource
        mock_resource_crud.get_by_id.return_value = mocked_resource

        monkeypatch.setattr(ResourceResponse, "model_validate", Mock(return_value=resource_response))
        monkeypatch.setattr(ResourceService, "get_variable_schema", AsyncMock(return_value=[]))

        result = await mock_resource_service.create(resource_create, requester)

        mock_resource_crud.create.assert_awaited_once_with(expected_resource_body)

        assert new_resource.state == ModelState.PROVISION
        assert new_resource.status == ModelStatus.APPROVAL_PENDING

        mock_revision_handler.handle_revision.assert_awaited_once_with(new_resource)
        mock_audit_log_handler.create_log.assert_awaited_once_with(new_resource.id, requester.id, ModelActions.CREATE)
        response = ResourceResponse.model_validate(new_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.CREATE)

        assert result.template.id == template_response.id
        assert result.name == mocked_resource.name
        assert result.source_code_version.id == source_code_version_response.id
        assert result.storage.id == storage_response.id

    @pytest.mark.asyncio
    async def test_create_error(
        self,
        mock_resource_service,
        mock_resource_crud,
        mocked_storage,
        mock_storage_crud,
        mocked_user_response,
        template_response,
        source_code_version_response,
        mock_source_code_version_crud,
        mock_template_crud,
        monkeypatch,
        mocked_resource,
        storage_response,
    ):
        resource_create = ResourceCreate(
            name=mocked_resource.name,
            template_id=template_response.id,
            source_code_version_id=source_code_version_response.id,
            storage_id=storage_response.id,
            storage_path="path/to/storage",
        )

        requester = mocked_user_response
        mock_storage_crud.get_by_id.return_value = mocked_storage
        mock_template_crud.get_by_id.return_value = template_response
        mock_source_code_version_crud.get_by_id.return_value = source_code_version_response
        monkeypatch.setattr(ResourceService, "get_variable_schema", AsyncMock(return_value=[]))

        error = RuntimeError("create fail")
        mock_resource_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_resource_service.create(resource_create, requester)

        assert exc.value is error
        mock_resource_crud.create.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_create_invalid_template_state(
        self,
        mock_resource_service,
        mocked_user,
        mocked_template,
        mock_template_crud,
        mocked_resource,
    ):
        mocked_template.abstract = True
        mocked_template.status = ModelStatus.DISABLED
        resource_create = ResourceCreate(
            name=mocked_resource.name,
            template_id=mocked_template.id,
        )

        requester = mocked_user
        mock_template_crud.get_by_id.return_value = mocked_template

        with pytest.raises(EntityWrongState, match="Template is not enabled"):
            await mock_resource_service.create(resource_create, requester)

    @pytest.mark.asyncio
    async def test_create_scv_wrong_state(
        self,
        mock_resource_service,
        mocked_user,
        mocked_template,
        mock_template_crud,
        mocked_resource,
        source_code_version,
        mock_source_code_version_crud,
    ):
        source_code_version.status = ModelStatus.DISABLED
        source_code_version.template_id = mocked_template.id
        mocked_template.abstract = False
        mocked_template.status = ModelStatus.ENABLED

        resource_create = ResourceCreate(
            name=mocked_resource.name,
            template_id=mocked_template.id,
            source_code_version_id=source_code_version.id,
        )

        requester = mocked_user
        mock_template_crud.get_by_id.return_value = mocked_template
        mock_source_code_version_crud.get_by_id.return_value = source_code_version

        with pytest.raises(EntityWrongState, match="Source code version is disabled"):
            await mock_resource_service.create(resource_create, requester)


class TestDelete:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.DESTROYED, ModelStatus.DONE),
            (ModelState.PROVISION, ModelStatus.REJECTED),
            (ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.APPROVAL_PENDING),
        ],
    )
    async def test_delete_success(
        self,
        state,
        status,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
        mock_permission_crud,
        mock_user_dto,
    ):
        existing_resource = mocked_resource
        existing_resource.state = state
        existing_resource.status = status

        mock_resource_crud.get_by_id.return_value = existing_resource
        await mock_resource_service.delete(resource_id=existing_resource.id, requester=mock_user_dto)

        mock_resource_crud.get_by_id.assert_awaited_once_with(existing_resource.id)
        mock_resource_crud.delete.assert_awaited_once_with(existing_resource)
        mock_log_crud.delete_by_entity_id.assert_awaited_once_with(existing_resource.id)
        mock_revision_handler.delete_revisions.assert_awaited_once_with(existing_resource.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_task_entity_crud.delete_by_entity_id.assert_awaited_once_with(existing_resource.id)
        mock_permission_crud.delete_entity_permissions.assert_awaited_once_with("resource", existing_resource.id)

    @pytest.mark.asyncio
    async def test_delete_resource_does_not_exist(
        self,
        mock_resource_service,
        mock_resource_crud,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_permission_crud,
    ):
        requester = Mock(spec=UserDTO)

        mock_resource_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Resource not found"):
            await mock_resource_service.delete(resource_id=RESOURCE_ID, requester=requester)
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_permission_crud.delete_entity_permissions.assert_not_awaited()


class TestGetTree:
    @pytest.mark.asyncio
    async def test_get_tree_success(self, mock_resource_service, mock_resource_crud):
        raw_node = {
            "id": f"{uuid4()}",
            "name": "Test Resource",
            "state": "state",
            "status": "status",
            "children": [],
            "parent_id": None,
            "template_name": "template1",
        }
        tree = [raw_node]
        mock_resource_crud.get_tree_to_parent.return_value = tree

        result = await mock_resource_service.get_tree(resource_id=RESOURCE_ID, direction="parents")

        mock_resource_crud.get_tree_to_parent.assert_awaited_once_with(RESOURCE_ID)
        assert result.name == "Test Resource"

    @pytest.mark.asyncio
    async def test_get_tree_does_not_exist(self, mock_resource_service, mock_resource_crud):
        mock_resource_crud.get_tree_to_parent.return_value = None

        with pytest.raises(EntityNotFound, match="Resource not found"):
            await mock_resource_service.get_tree(resource_id=RESOURCE_ID, direction="parents")


class TestParentConfigs:
    @pytest.mark.asyncio
    async def test_get_parents_configs(self, mock_resource_service, many_resource_response):
        list_of_ids = [r.id for r in many_resource_response]
        list_of_resources_in_dict = [r.model_dump() for r in many_resource_response]
        mock_resource_service.crud.get_parents_with_configs.return_value = list_of_resources_in_dict
        mock_resource_service.crud.get_parent_ids.return_value = list_of_ids
        result = await mock_resource_service.get_parents_with_configs(
            resource_id=list_of_ids[:-1],
        )
        assert isinstance(result, list)
        assert len(result) == 4
        assert all(isinstance(item, ResourceWithConfigs) for item in result)


class TestSCVSchema:
    @pytest.mark.asyncio
    async def test_get_source_code_version_schema(self, mock_source_code_version_service, mock_resource_service):
        scv_short1 = {
            "id": uuid4(),
            "source_code_version": "test_scv",
            "source_code_folder": "test_folder/test",
        }
        scv_short2 = {
            "id": uuid4(),
            "source_code_version": "test_scv2",
            "source_code_folder": "test_folder/test2",
        }
        # Mock the return value of get_configs_by_scv_id
        mock_source_code_version_service.crud.get_configs_by_scv_id.return_value = [
            {
                "id": uuid4(),
                "index": 0,
                "source_code_version": scv_short1,
                "required": False,
                "default": None,
                "frozen": False,
                "unique": False,
                "name": "Config 1",
                "description": "Test config",
                "type": "string",
                "options": [],
                "reference": None,
            },
            {
                "id": uuid4(),
                "index": 1,
                "source_code_version": scv_short1,
                "required": True,
                "default": None,
                "frozen": False,
                "unique": True,
                "name": "Config 2",
                "description": "Test config 2",
                "type": "string",
                "options": [],
                "reference": None,
            },
            {
                "id": uuid4(),
                "index": 2,
                "source_code_version": scv_short1,
                "required": False,
                "default": None,
                "frozen": False,
                "unique": False,
                "name": "Config 3",
                "description": "Test config 3",
                "type": "string",
                "options": [],
                "reference": None,
            },
        ]

        # Mock the return value of get_all
        resource1 = {
            "id": uuid4(),
            "name": "Resource1",
            "template": {"id": uuid4(), "name": "Resource1", "template": "template_one"},
            "source_code_version": scv_short1,
            "storage": {"id": uuid4(), "name": "Storage1"},
            "creator": {"id": uuid4(), "name": "User1", "identifier": "user1", "provider": "provider1"},
            "variables": [
                {
                    "name": "var1",
                    "value": "value1",
                    "required": True,
                    "frozen": False,
                    "unique": False,
                },
                {
                    "name": "var2",
                    "value": "value2",
                    "required": True,
                    "frozen": False,
                    "unique": True,
                },
            ],
        }

        resource2 = {
            "id": uuid4(),
            "name": "Resource2",
            "template": {"id": uuid4(), "name": "Resource2", "template": "template_two"},
            "source_code_version": scv_short2,
            "storage": {"id": uuid4(), "name": "Storage2"},
            "creator": {"id": uuid4(), "name": "User2", "identifier": "user2", "provider": "provider2"},
            "variables": [
                {
                    "name": "var3",
                    "value": "value3",
                    "required": True,
                    "frozen": False,
                    "unique": False,
                },
                {
                    "name": "var4",
                    "value": None,
                    "required": False,
                    "frozen": False,
                    "unique": True,
                },
            ],
        }
        mock_resource_service.crud.get_all.return_value = [resource1, resource2]

        # Call the function with test data
        # TODO: finish this test


class TestGetResourceActions:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status,state,user_permissions,expected_actions",
        [
            # Wrong resource state
            (
                ModelState.PROVISION,
                ModelStatus.IN_PROGRESS,
                ["read", "write", "admin"],
                [],
            ),
            # Read permission only
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read"],
                [],
            ),
            # Write permission
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read", "write"],
                [
                    ModelActions.DESTROY,
                    ModelActions.EDIT,
                    ModelActions.EXECUTE,
                    ModelActions.DOWNLOAD,
                    ModelActions.DRYRUN,
                ],
            ),
            (
                ModelStatus.READY,
                ModelState.PROVISION,
                ["read", "write"],
                [
                    ModelActions.EDIT,
                    ModelActions.EXECUTE,
                    ModelActions.DOWNLOAD,
                    ModelActions.DELETE,
                    ModelActions.DRYRUN,
                ],
            ),
            (
                ModelStatus.ERROR,
                ModelState.PROVISION,
                ["read", "write"],
                [
                    ModelActions.DESTROY,
                    ModelActions.DOWNLOAD,
                    ModelActions.EXECUTE,
                    ModelActions.DRYRUN,
                    ModelActions.EDIT,
                ],
            ),
            (
                ModelStatus.APPROVAL_PENDING,
                ModelState.PROVISION,
                ["read", "write"],
                [ModelActions.EDIT, ModelActions.DRYRUN, ModelActions.DOWNLOAD, ModelActions.DELETE],
            ),
            (
                ModelStatus.APPROVAL_PENDING,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.EDIT, ModelActions.DRYRUN, ModelActions.DOWNLOAD],
            ),
            (
                ModelStatus.DONE,
                ModelState.DESTROYED,
                ["read", "write"],
                [ModelActions.RECREATE],
            ),
            (ModelStatus.DONE, ModelState.DESTROYED, ["read", "write"], [ModelActions.RECREATE]),
            (
                ModelStatus.ERROR,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.RECREATE, ModelActions.DOWNLOAD, ModelActions.EXECUTE, ModelActions.DRYRUN],
            ),
            (
                ModelStatus.READY,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.RECREATE, ModelActions.DOWNLOAD, ModelActions.EXECUTE, ModelActions.DRYRUN],
            ),
            (ModelStatus.REJECTED, ModelState.PROVISION, ["read", "write"], [ModelActions.RECREATE]),
            # Admin permission
            (
                ModelStatus.APPROVAL_PENDING,
                ModelState.PROVISION,
                ["read", "write", "admin"],
                [
                    ModelActions.EDIT,
                    ModelActions.DRYRUN,
                    ModelActions.DOWNLOAD,
                    ModelActions.APPROVE,
                    ModelActions.REJECT,
                    ModelActions.DELETE,
                ],
            ),
            (
                ModelStatus.ERROR,
                ModelState.PROVISION,
                ["read", "write", "admin"],
                [
                    ModelActions.DESTROY,
                    ModelActions.DOWNLOAD,
                    ModelActions.EXECUTE,
                    ModelActions.DRYRUN,
                    ModelActions.EDIT,
                ],
            ),
            (
                ModelStatus.DONE,
                ModelState.DESTROYED,
                ["read", "write", "admin"],
                [ModelActions.RECREATE, ModelActions.DELETE],
            ),
            (
                ModelStatus.ERROR,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.RECREATE, ModelActions.DOWNLOAD, ModelActions.EXECUTE, ModelActions.DRYRUN],
            ),
            (
                ModelStatus.READY,
                ModelState.DESTROY,
                ["read", "write"],
                [ModelActions.RECREATE, ModelActions.DOWNLOAD, ModelActions.EXECUTE, ModelActions.DRYRUN],
            ),
            (ModelStatus.REJECTED, ModelState.PROVISION, ["read", "write"], [ModelActions.RECREATE]),
        ],
    )
    async def test_get_resource_user_actions_without_temporary_state(
        self,
        status,
        state,
        user_permissions,
        expected_actions,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
        mocked_resource_temp_state_handler,
    ):
        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mocked_resource_temp_state_handler.get_by_resource_id.return_value = None
        mock_user_permissions(user_permissions, monkeypatch, "application.resources.service.user_entity_permissions")
        mock_resource_crud.get_by_id.return_value = mocked_resource

        result = await mock_resource_service.get_actions(resource_id=mocked_resource.id, requester=mock_user_dto)

        assert sorted(result) == sorted(expected_actions)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "status,state,user_permissions,expected_actions",
        [
            # Write permission
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read", "write"],
                [
                    ModelActions.DESTROY,
                    ModelActions.EDIT,
                    ModelActions.EXECUTE,
                    ModelActions.DOWNLOAD,
                    "has_temporary_state",
                    "dryrun_with_temp_state",
                    ModelActions.DRYRUN,
                ],
            ),
            (
                ModelStatus.READY,
                ModelState.PROVISION,
                ["read", "write"],
                [
                    ModelActions.EDIT,
                    ModelActions.EXECUTE,
                    ModelActions.DOWNLOAD,
                    ModelActions.DELETE,
                    "has_temporary_state",
                    "dryrun_with_temp_state",
                    ModelActions.DRYRUN,
                ],
            ),
            # Admin permission
            (
                ModelStatus.DONE,
                ModelState.PROVISIONED,
                ["read", "write", "admin"],
                [
                    ModelActions.DESTROY,
                    ModelActions.EDIT,
                    ModelActions.EXECUTE,
                    ModelActions.DOWNLOAD,
                    "has_temporary_state",
                    "dryrun_with_temp_state",
                    ModelActions.APPROVE,
                    ModelActions.REJECT,
                    ModelActions.DRYRUN,
                ],
            ),
            (
                ModelStatus.READY,
                ModelState.PROVISION,
                ["read", "write", "admin"],
                [
                    ModelActions.EDIT,
                    ModelActions.EXECUTE,
                    ModelActions.DOWNLOAD,
                    ModelActions.DELETE,
                    "has_temporary_state",
                    "dryrun_with_temp_state",
                    ModelActions.APPROVE,
                    ModelActions.REJECT,
                    ModelActions.DRYRUN,
                ],
            ),
        ],
    )
    async def test_get_resource_user_actions_with_temporary_state(
        self,
        status,
        state,
        user_permissions,
        expected_actions,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
        mocked_resource_temp_state_handler,
        mocked_resource_temp_state,
    ):
        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mocked_resource_temp_state_handler.get_by_resource_id.return_value = mocked_resource_temp_state
        mock_user_permissions(user_permissions, monkeypatch, "application.resources.service.user_entity_permissions")
        mock_resource_crud.get_by_id.return_value = mocked_resource

        result = await mock_resource_service.get_actions(resource_id=mocked_resource.id, requester=mock_user_dto)

        assert sorted(result) == sorted(expected_actions)


class TestSyncWorkspace:
    @pytest.mark.asyncio
    async def test_sync_workspace_resource_not_found(
        self,
        mock_resource_service,
        mock_resource_crud,
    ):
        mock_resource_crud.get_by_id.return_value = None
        requester = Mock(spec=UserDTO)

        with pytest.raises(EntityNotFound, match="Resource not found"):
            await mock_resource_service.sync_workspace(resource_id=RESOURCE_ID, requester=requester)

        mock_resource_crud.get_by_id.assert_awaited_once_with(RESOURCE_ID)

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state",
        [
            ModelState.PROVISION,
            ModelState.DESTROY,
        ],
    )
    async def test_sync_workspace_wrong_state(
        self,
        state,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
    ):
        mocked_resource.state = state
        mock_resource_crud.get_by_id.return_value = mocked_resource
        requester = Mock(spec=UserDTO)

        with pytest.raises(ValueError, match="Resource cannot be synced because of the wrong state"):
            await mock_resource_service.sync_workspace(resource_id=str(mocked_resource.id), requester=requester)

        mock_resource_crud.get_by_id.assert_awaited_once_with(str(mocked_resource.id))

    @pytest.mark.asyncio
    async def test_sync_workspace_no_workspace_id(
        self,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
    ):
        mocked_resource.state = ModelState.PROVISIONED
        mocked_resource.workspace_id = None
        mock_resource_crud.get_by_id.return_value = mocked_resource
        requester = Mock(spec=UserDTO)

        with pytest.raises(EntityNotFound, match="Resource doesn't have assigned workspace"):
            await mock_resource_service.sync_workspace(resource_id=str(mocked_resource.id), requester=requester)

        mock_resource_crud.get_by_id.assert_awaited_once_with(str(mocked_resource.id))

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state",
        [
            ModelState.PROVISIONED,
            ModelState.DESTROYED,
        ],
    )
    async def test_sync_workspace_success(
        self,
        state,
        mock_resource_service,
        mock_resource_crud,
        mock_event_sender,
        mocked_resource,
        resource_response,
        monkeypatch,
        mock_user_dto,
    ):
        mocked_resource.state = state
        mocked_resource.workspace_id = uuid4()
        mock_resource_crud.get_by_id.return_value = mocked_resource
        mocked_validate = Mock(return_value=resource_response)
        monkeypatch.setattr(ResourceResponse, "model_validate", mocked_validate)

        result = await mock_resource_service.sync_workspace(
            resource_id=str(mocked_resource.id), requester=mock_user_dto
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(str(mocked_resource.id))
        mock_event_sender.send_task.assert_awaited_once_with(
            mocked_resource.id, requester=mock_user_dto, action=ModelActions.SYNC
        )
        mocked_validate.assert_called_once_with(mocked_resource)
        assert result == resource_response
