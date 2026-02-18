from unittest.mock import Mock, call
from uuid import uuid4

import pytest

from application.resources.schema import (
    ResourceResponse,
    ResourcePatch,
)
from core.base_models import PatchBodyModel
from core.config import InfrakitchenConfig
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.errors import DependencyError, EntityNotFound, EntityWrongState
from core.users.model import UserDTO

RESOURCE_ID = "abc123"


class TestPatch:
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status, expected_state, expected_status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.PROVISIONED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.PROVISION, ModelStatus.ERROR),
        ],
    )
    async def test_patch_success_and_create_temp_state(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource,
        mocked_user_response,
        mocked_resource_temp_state_handler,
    ):
        resource_patch = ResourcePatch(description="Resource description")
        resource_id = uuid4()
        existing_resource = mocked_resource
        updated_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.state = state
        existing_resource.status = status
        existing_resource.abstract = True

        updated_resource.id = resource_id
        updated_resource.state = expected_state
        updated_resource.status = expected_status
        updated_resource.abstract = True

        mock_resource_crud.get_by_id.return_value = existing_resource
        requester = mocked_user_response

        result = await mock_resource_service.patch(
            resource_id=resource_id, resource=resource_patch, requester=requester
        )

        assert result.state == expected_state
        assert result.status == expected_status

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)

        mocked_resource_temp_state_handler.set_resource_temp_state.assert_awaited_once_with(
            resource_id=resource_id, value=resource_patch.model_dump(exclude_unset=True), created_by=requester.id
        )

        response = ResourceResponse.model_validate(updated_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.UPDATE)

        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_resource_crud.patch.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_patch_resource_does_not_exist(self, mock_resource_service, mock_resource_crud, mock_user_dto):
        resource_update = Mock(spec=ResourcePatch)
        mock_resource_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Resource not found"):
            await mock_resource_service.patch(
                resource_id=RESOURCE_ID, resource=resource_update, requester=mock_user_dto
            )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.PROVISION, ModelStatus.QUEUED),
            (ModelState.DESTROY, ModelStatus.READY),
            (ModelState.DESTROYED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.IN_PROGRESS),
        ],
    )
    async def test_patch_resource_has_invalid_status(
        self, state, status, mock_resource_service, mock_resource_crud, mocked_resource, mock_user_dto
    ):
        resource_update = Mock(spec=ResourcePatch)
        resource_update.source_code_version_id = None

        existing_resource = mocked_resource
        existing_resource.id = uuid4()
        existing_resource.status = status
        existing_resource.state = state
        existing_resource.source_code_version_id = None
        mock_resource_crud.get_by_id.return_value = existing_resource

        with pytest.raises(ValueError):
            await mock_resource_service.patch(
                resource_id=existing_resource.id, resource=resource_update, requester=mock_user_dto
            )

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.PROVISIONED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.ERROR, ModelState.PROVISIONED, ModelStatus.ERROR),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.PROVISION, ModelStatus.ERROR),
        ],
    )
    async def test_patch_all_fields(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mocked_user_response,
        mocked_resource,
        mocked_resource_temp_state_handler,
        mock_revision_handler,
    ):
        resource_patch = ResourcePatch(
            name="name",
            description="desc",
            source_code_version_id=uuid4(),
            integration_ids=[uuid4()],
            secret_ids=[],
            labels=["label1"],
            workspace_id=uuid4(),
            variables=[],
            dependency_tags=[],
            dependency_config=[],
        )
        resource_patch.source_code_version_id = None

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.state = state
        existing_resource.status = status

        mock_resource_crud.get_by_id.return_value = existing_resource
        mock_resource_service.resource_temp_state_handler = mocked_resource_temp_state_handler
        mock_resource_service.revision_handler = mock_revision_handler

        result = await mock_resource_service.patch(
            resource_id=str(resource_id), resource=resource_patch, requester=mocked_user_response
        )

        assert result.state == expected_state
        assert result.status == expected_status
        mock_resource_crud.get_by_id.assert_awaited_once_with(str(resource_id))
        mocked_resource_temp_state_handler.set_resource_temp_state.assert_awaited_once_with(
            resource_id=resource_id, value=resource_patch.model_dump(), created_by=mocked_user_response.id
        )

    @pytest.mark.asyncio
    async def test_patch_error(
        self, mock_resource_service, mock_resource_crud, template_response, mocked_user_response, monkeypatch
    ):
        resource_update = Mock(spec=ResourcePatch)

        error = RuntimeError("get resource fail")
        mock_resource_crud.get_by_id.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_resource_service.patch(
                resource_id=RESOURCE_ID, resource=resource_update, requester=mocked_user_response
            )

        assert exc.value is error


class TestPatchAction:
    # Approve action
    @pytest.mark.asyncio
    async def test_patch_approve_after_resource_created(
        self,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = ModelStatus.APPROVAL_PENDING
        existing_resource.state = ModelState.PROVISION

        mock_resource_crud.get_by_id.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = None

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_once_with(resource_id=resource_id)
        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.APPROVE
        )

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.APPROVE)

        assert result.status == ModelStatus.READY
        assert result.state == ModelState.PROVISION

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, status, expected_state, expected_status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.PROVISIONED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.PROVISION, ModelStatus.ERROR),
        ],
    )
    async def test_patch_approve_when_provisioned_resource_edited(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mocked_resource_temp_state,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource
        for key, value in mocked_resource_temp_state.value.items():
            setattr(existing_resource, key, value)

        mock_resource_crud.update.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = mocked_resource_temp_state

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_once_with(resource_id=resource_id)
        mock_resource_crud.update.assert_awaited_once_with(existing_resource, mocked_resource_temp_state.value)

        mock_audit_log_handler.create_log.assert_has_calls(
            [
                call(existing_resource.id, mocked_user.id, ModelActions.APPROVE),
                call(existing_resource.id, mocked_resource_temp_state.created_by, ModelActions.UPDATE),
            ]
        )
        mock_revision_handler.handle_revision.assert_awaited_once_with(existing_resource)
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_awaited_once_with(
            resource_id=existing_resource.id
        )

        mock_resource_crud.refresh.assert_has_calls([call(existing_resource)])

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.APPROVE)

        assert result.status == expected_status
        assert result.state == expected_state

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state, status, expected_state, expected_status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.PROVISION, ModelStatus.READY),
        ],
    )
    async def test_patch_approve_when_provisioned_resource_edited_include_variables(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mocked_resource_temp_state,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource
        for key, value in mocked_resource_temp_state.value.items():
            setattr(existing_resource, key, value)

        # set variables to test the variables are updated after approval
        mocked_resource_temp_state.value["variables"] = [{"name": "var1", "value": "value1"}]
        existing_resource.variables = [{"name": "var1", "value": "old_value"}]

        mock_resource_crud.update.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = mocked_resource_temp_state

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_once_with(resource_id=resource_id)
        mock_resource_crud.update.assert_awaited_once_with(existing_resource, mocked_resource_temp_state.value)

        mock_audit_log_handler.create_log.assert_has_calls(
            [
                call(existing_resource.id, mocked_user.id, ModelActions.APPROVE),
                call(existing_resource.id, mocked_resource_temp_state.created_by, ModelActions.UPDATE),
            ]
        )
        mock_revision_handler.handle_revision.assert_awaited_once_with(existing_resource)
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_awaited_once_with(
            resource_id=existing_resource.id
        )

        mock_resource_crud.refresh.assert_has_calls([call(existing_resource)])

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.APPROVE)

        assert result.status == expected_status
        assert result.state == expected_state

    @pytest.mark.asyncio
    async def test_patch_approve_destroy(
        self,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = ModelStatus.APPROVAL_PENDING
        existing_resource.state = ModelState.DESTROY

        mock_resource_crud.get_by_id.return_value = existing_resource

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.APPROVE
        )
        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.APPROVE)

        assert result.status == ModelStatus.READY
        assert result.state == ModelState.DESTROY

    @pytest.mark.asyncio
    async def test_patch_resource_does_not_exist(self, mock_resource_service, mock_resource_crud):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)
        requester = Mock(spec=UserDTO)

        mock_resource_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Resource not found"):
            await mock_resource_service.patch_action(resource_id=RESOURCE_ID, body=patch_body, requester=requester)

    @pytest.mark.asyncio
    async def test_patch_approve_invalid_status(
        self, mock_resource_service, mock_resource_crud, mocked_user, mocked_resource
    ):
        patch_body = PatchBodyModel(action=ModelActions.APPROVE)

        existing_resource = mocked_resource
        existing_resource.id = uuid4()
        existing_resource.status = ModelStatus.REJECTED
        existing_resource.state = ModelState.PROVISION
        mock_resource_crud.get_by_id.return_value = existing_resource

        with pytest.raises(ValueError) as exc:
            await mock_resource_service.patch_action(
                resource_id=existing_resource.id, body=patch_body, requester=mocked_user
            )

        assert "Resource has wrong state for approval" in str(exc.value)

    # Reject action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.PROVISION, ModelStatus.APPROVAL_PENDING, ModelState.PROVISION, ModelStatus.REJECTED),
            (ModelState.DESTROY, ModelStatus.APPROVAL_PENDING, ModelState.PROVISIONED, ModelStatus.DONE),
        ],
    )
    async def test_patch_reject(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.REJECT)
        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = str(resource_id)
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = None

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_with(resource_id=resource_id)

        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once_with(resource_id, mocked_user.id, ModelActions.REJECT)

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.REJECT)
        assert result.status == expected_status
        assert result.state == expected_state

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.PROVISIONED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.READY),
        ],
    )
    async def test_patch_reject_when_provisioned_resource_edited(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mocked_resource_temp_state,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.REJECT)
        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = mocked_resource_temp_state

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_once_with(resource_id=existing_resource.id)

        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_awaited_once_with(
            resource_id=existing_resource.id
        )

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.REJECT
        )

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.REJECT)

        assert result.status == expected_status
        assert result.state == expected_state

    # Destroy action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status, disabled_approval_flow_feature",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.DESTROY, ModelStatus.READY, True),
            (ModelState.PROVISIONED, ModelStatus.DONE, ModelState.DESTROY, ModelStatus.APPROVAL_PENDING, False),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.DESTROY, ModelStatus.READY, True),
            (ModelState.PROVISION, ModelStatus.ERROR, ModelState.DESTROY, ModelStatus.APPROVAL_PENDING, False),
        ],
    )
    async def test_patch_destroy_without_temp_state(
        self,
        state,
        status,
        expected_state,
        expected_status,
        disabled_approval_flow_feature,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        if disabled_approval_flow_feature is True:
            InfrakitchenConfig().approval_flow = False

        patch_body = PatchBodyModel(action=ModelActions.DESTROY)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = None

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_once_with(resource_id=resource_id)

        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.DESTROY
        )

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DESTROY)

        assert result.status == expected_status
        assert result.state == expected_state
        InfrakitchenConfig().approval_flow = True

    @pytest.mark.asyncio
    async def test_patch_destroy_with_temp_state(
        self,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_resource_temp_state_handler,
        mocked_resource_temp_state,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DESTROY)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = ModelStatus.READY
        existing_resource.state = ModelState.PROVISIONED

        mock_resource_crud.get_by_id.return_value = existing_resource
        mocked_resource_temp_state_handler.get_by_resource_id.return_value = mocked_resource_temp_state

        with pytest.raises(ValueError) as exc:
            await mock_resource_service.patch_action(resource_id=resource_id, body=patch_body, requester=mocked_user)

        assert "Cannot delete a resource with hanging updates" in str(exc.value)

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mocked_resource_temp_state_handler.get_by_resource_id.assert_awaited_once_with(resource_id=resource_id)

        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()
        mocked_resource_temp_state_handler.delete_by_resource_id.assert_not_awaited()
        mock_resource_crud.refresh.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_event_sender.send_event.assert_not_awaited()

    # Recreate action
    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status, disabled_approval_flow_feature",
        [
            (ModelState.PROVISION, ModelStatus.REJECTED, ModelState.PROVISION, ModelStatus.READY, True),
            (ModelState.PROVISION, ModelStatus.REJECTED, ModelState.PROVISION, ModelStatus.APPROVAL_PENDING, False),
            (ModelState.DESTROY, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.READY, False),
            (ModelState.DESTROYED, ModelStatus.DONE, ModelState.PROVISION, ModelStatus.APPROVAL_PENDING, False),
        ],
    )
    async def test_patch_recreate(
        self,
        state,
        status,
        expected_state,
        expected_status,
        disabled_approval_flow_feature,
        mock_resource_service,
        mock_resource_crud,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
        mocked_resource,
    ):
        if disabled_approval_flow_feature is True:
            InfrakitchenConfig().approval_flow = False

        patch_body = PatchBodyModel(action=ModelActions.RECREATE)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.RECREATE
        )

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.RECREATE)

        assert result.status == expected_status
        assert result.state == expected_state

        InfrakitchenConfig().approval_flow = True

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status",
        [
            (ModelState.PROVISIONED, ModelStatus.DONE),
            (ModelState.PROVISIONED, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.READY),
            (ModelState.PROVISION, ModelStatus.ERROR),
            (ModelState.PROVISION, ModelStatus.IN_PROGRESS),
            (ModelState.PROVISIONED, ModelStatus.IN_PROGRESS),
            (ModelState.PROVISIONED, ModelStatus.QUEUED),
            (ModelState.PROVISION, ModelStatus.QUEUED),
        ],
    )
    async def test_patch_recreate_invalid_status(
        self, status, state, mock_resource_service, mock_resource_crud, mocked_user, mocked_resource
    ):
        patch_body = PatchBodyModel(action=ModelActions.RECREATE)

        existing_resource = mocked_resource
        existing_resource.id = uuid4()
        existing_resource.status = status
        existing_resource.state = state
        mock_resource_crud.get_by_id.return_value = existing_resource

        with pytest.raises(EntityWrongState, match="Entity cannot be recreated, has wrong state"):
            await mock_resource_service.patch_action(
                resource_id=existing_resource.id, body=patch_body, requester=mocked_user
            )

    @pytest.mark.asyncio
    async def test_patch_recreate_dependency_wrong_state(
        self,
        mock_resource_service,
        mock_resource_crud,
        mocked_user,
        mocked_resource,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RECREATE)

        existing_resource = mocked_resource
        parent_resource2 = mocked_resource
        parent_resource = mocked_resource
        parent_resource.id = uuid4()
        parent_resource.state = ModelState.DESTROYED
        parent_resource.status = ModelStatus.DONE
        parent_resource2.id = uuid4()
        parent_resource2.state = ModelState.PROVISIONED
        parent_resource2.status = ModelStatus.READY
        existing_resource.id = uuid4()
        existing_resource.status = ModelStatus.REJECTED
        existing_resource.state = ModelState.PROVISION
        existing_resource.parents = [parent_resource, parent_resource2]
        mock_resource_crud.get_by_id.return_value = existing_resource

        with pytest.raises(DependencyError, match="Parent resource has wrong state.") as exc:
            await mock_resource_service.patch_action(
                resource_id=existing_resource.id, body=patch_body, requester=mocked_user
            )

        assert exc.value.metadata[0]["id"] == parent_resource.id

    @pytest.mark.asyncio
    @pytest.mark.parametrize(
        "state,status,expected_state,expected_status",
        [
            (ModelState.PROVISION, ModelStatus.READY, ModelState.PROVISION, ModelStatus.QUEUED),
            (ModelState.PROVISIONED, ModelStatus.READY, ModelState.PROVISIONED, ModelStatus.QUEUED),
            (ModelState.PROVISIONED, ModelStatus.ERROR, ModelState.PROVISIONED, ModelStatus.QUEUED),
            (ModelState.DESTROY, ModelStatus.READY, ModelState.DESTROY, ModelStatus.QUEUED),
        ],
    )
    async def test_patch_execute_action(
        self,
        state,
        status,
        expected_state,
        expected_status,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.EXECUTE)

        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = status
        existing_resource.state = state

        mock_resource_crud.get_by_id.return_value = existing_resource

        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )

        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mock_resource_crud.update.assert_not_awaited()
        mock_revision_handler.handle_revision.assert_not_awaited()

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.EXECUTE
        )

        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.EXECUTE)

        assert result.status == expected_status
        assert result.state == expected_state

    @pytest.mark.asyncio
    async def test_retry_action(
        self,
        mock_resource_service,
        mock_resource_crud,
        mocked_resource,
        mock_audit_log_handler,
        mock_event_sender,
        mock_revision_handler,
        mocked_user,
    ):
        patch_body = PatchBodyModel(action=ModelActions.RETRY)
        resource_id = uuid4()
        existing_resource = mocked_resource
        existing_resource.id = resource_id
        existing_resource.status = ModelStatus.QUEUED
        existing_resource.state = ModelState.PROVISIONED
        mock_resource_crud.get_by_id.return_value = existing_resource
        result = await mock_resource_service.patch_action(
            resource_id=resource_id, body=patch_body, requester=mocked_user
        )
        mock_resource_crud.get_by_id.assert_awaited_once_with(resource_id)
        mock_revision_handler.handle_revision.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_resource.id, mocked_user.id, ModelActions.RETRY
        )
        response = ResourceResponse.model_validate(existing_resource)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.RETRY)
        assert result.status == ModelStatus.QUEUED
        assert result.state == ModelState.PROVISIONED
