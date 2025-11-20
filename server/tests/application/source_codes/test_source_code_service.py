from unittest.mock import Mock
from uuid import uuid4

import pytest
from pydantic import PydanticUserError

from application.source_codes.model import SourceCode
from application.source_codes.schema import SourceCodeResponse, SourceCodeCreate, SourceCodeUpdate
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound, EntityWrongState

SOURCE_CODE_ID = "1985435id-1234-5678-90ab-cdef12345678"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        monkeypatch,
        mocked_source_code,
        mocked_source_code_response,
    ):
        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        monkeypatch.setattr(SourceCodeResponse, "model_validate", Mock(return_value=mocked_source_code_response))

        result = await mock_source_code_service.get_by_id(mocked_source_code.id)

        assert result == mocked_source_code_response
        mock_source_code_crud.get_by_id.assert_called_once_with(mocked_source_code.id)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.get_by_id.return_value = None

        result = await mock_source_code_service.get_by_id("invalid_id")

        assert result is None
        mock_source_code_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_empty(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.get_by_id.return_value = None

        result = await mock_source_code_service.get_by_id(SOURCE_CODE_ID)
        assert result is None
        mock_source_code_crud.get_by_id.assert_awaited_once_with(SOURCE_CODE_ID)

    @pytest.mark.asyncio
    async def test_get_by_id_error(
        self, mock_source_code_service, mock_source_code_crud, monkeypatch, mocked_source_code
    ):
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SourceCodeResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_source_code_service.get_by_id(mocked_source_code.id)

        assert exc.value is error
        assert exc.value.message == error.message
        mock_source_code_crud.get_by_id.assert_called_once_with(mocked_source_code.id)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_source_code_service, mock_source_code_crud, monkeypatch):
        source_codes = [
            SourceCode(
                description="Test Source Code 1",
                source_code_url="https://example.com/source1",
                source_code_provider="github",
                source_code_language="opentofu",
                integration_id="12345678-1234-5678-90ab-cdef12345678",
            ),
            SourceCode(
                description="Test Source Code 2",
                source_code_url="https://example.com/source2",
                source_code_provider="bitbucket",
                source_code_language="opentofu",
                integration_id="87654321-1234-5678-90ab-cdef12345678",
            ),
        ]

        mock_source_code_crud.get_all.return_value = source_codes

        def mock_model_validate(arg):
            return arg

        monkeypatch.setattr(SourceCodeResponse, "model_validate", mock_model_validate)

        result = await mock_source_code_service.get_all(limit=5)

        assert result == source_codes
        mock_source_code_crud.get_all.assert_awaited_once_with(limit=5)

    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.get_all.return_value = []

        result = await mock_source_code_service.get_all(limit=5)

        assert not result
        mock_source_code_crud.get_all.assert_awaited_once_with(limit=5)

    @pytest.mark.asyncio
    async def test_get_all_error(
        self, mock_source_code_service, mock_source_code_crud, monkeypatch, mocked_source_code
    ):
        mock_source_code_crud.get_all.return_value = [mocked_source_code]
        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SourceCodeResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_source_code_service.get_all(limit=5)

        assert exc.value is error
        mock_source_code_crud.get_all.assert_awaited_once_with(limit=5)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.count.return_value = 5

        result = await mock_source_code_service.count(filter={"key": "value"})

        assert result == 5
        mock_source_code_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_source_code_service, mock_source_code_crud):
        mock_source_code_crud.count.side_effect = RuntimeError("DB error")

        with pytest.raises(RuntimeError) as exc:
            await mock_source_code_service.count(filter={"key": "value"})

        assert isinstance(exc.value, RuntimeError)
        assert str(exc.value) == "DB error"
        mock_source_code_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_source_code,
        mocked_source_code_response,
        mock_user_dto,
    ):
        source_code_to_create_body = {
            "description": "Test Source Code 1",
            "source_code_url": "source_code_url",
            "source_code_provider": "github",
            "source_code_language": "opentofu",
            "integration_id": str(mocked_source_code.integration_id),
            "labels": ["label1", "label2"],
        }

        mocked_source_code_create = Mock(spec=SourceCodeCreate)
        mocked_source_code_create.description = source_code_to_create_body["description"]
        mocked_source_code_create.source_code_url = source_code_to_create_body["source_code_url"]
        mocked_source_code_create.source_code_provider = source_code_to_create_body["source_code_provider"]
        mocked_source_code_create.source_code_language = source_code_to_create_body["source_code_language"]
        mocked_source_code_create.integration_id = source_code_to_create_body["integration_id"]
        mocked_source_code_create.labels = source_code_to_create_body["labels"]

        mocked_source_code_create.model_dump = Mock(return_value=source_code_to_create_body)

        created_source_code = SourceCode(id=mocked_source_code.id, **source_code_to_create_body)

        mock_source_code_crud.create.return_value = created_source_code
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        monkeypatch.setattr(SourceCodeResponse, "model_validate", Mock(return_value=mocked_source_code_response))

        saved_source_code = await mock_source_code_service.create(
            source_code=mocked_source_code_create, requester=mock_user_dto
        )

        mocked_source_code_create.model_dump.assert_called_once_with(exclude_unset=True)
        mock_source_code_crud.create.assert_awaited_once_with(source_code_to_create_body)

        assert created_source_code.status == ModelStatus.READY

        mock_revision_handler.handle_revision.assert_called_once_with(created_source_code)
        mock_audit_log_handler.create_log.assert_awaited_once_with(created_source_code.id, mock_user_dto.id, "create")
        response = SourceCodeResponse.model_validate(mocked_source_code_response)
        mock_event_sender.send_event.assert_awaited_once_with(response, "create")

        assert saved_source_code.description == mocked_source_code_create.description
        assert saved_source_code.source_code_url == mocked_source_code_create.source_code_url


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_source_code,
        mocked_source_code_response,
        mock_user_dto,
    ):
        update_body = {
            "description": "Test Source Code 1 new",
            "integration_id": str(mocked_source_code.integration_id),
            "updated_by": str(mock_user_dto.id),
        }

        mocked_source_code_update = Mock(spec=SourceCodeUpdate)
        mocked_source_code_update.model_dump = Mock(return_value=update_body)

        existing_source_code = mocked_source_code
        existing_source_code.status = ModelStatus.DONE

        updated_source_code = mocked_source_code
        updated_source_code.description = update_body["description"]

        updated_source_code_response = mocked_source_code_response
        updated_source_code_response.description = update_body["description"]
        updated_source_code_response.status = ModelStatus.READY

        mock_source_code_crud.update.return_value = updated_source_code
        mock_source_code_crud.get_by_id.return_value = existing_source_code

        monkeypatch.setattr(SourceCodeResponse, "model_validate", Mock(return_value=updated_source_code_response))

        result = await mock_source_code_service.update(
            source_code_id=existing_source_code.id, source_code=mocked_source_code_update, requester=mock_user_dto
        )

        mocked_source_code_update.model_dump.assert_called_once_with(exclude_unset=True)
        mock_source_code_crud.update.assert_awaited_once_with(existing_source_code, update_body)
        mock_source_code_crud.refresh.assert_called_once_with(updated_source_code)
        mock_audit_log_handler.create_log.assert_awaited_once_with(updated_source_code.id, mock_user_dto.id, "update")
        mock_revision_handler.handle_revision.assert_called_once_with(existing_source_code)
        response = SourceCodeResponse.model_validate(updated_source_code_response)
        mock_event_sender.send_event.assert_awaited_once_with(response, "update")

        assert result.status == ModelStatus.READY

    @pytest.mark.asyncio
    async def test_update_not_found(self, mock_source_code_service, mock_source_code_crud, mock_user_dto):
        source_code_update = Mock(spec=SourceCodeUpdate)
        mock_source_code_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="SourceCode not found"):
            await mock_source_code_service.update(
                source_code_id="123id", source_code=source_code_update, requester=mock_user_dto
            )

    @pytest.mark.asyncio
    @pytest.mark.parametrize("invalid_status", [ModelStatus.IN_PROGRESS, ModelStatus.DISABLED, ModelStatus.QUEUED])
    async def test_update_source_code_has_invalid_status(
        self, invalid_status, mock_source_code_service, mock_source_code_crud, mock_user_dto, mocked_source_code
    ):
        mocked_source_code.status = invalid_status
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(EntityWrongState, match=f"Entity has wrong status for updating {invalid_status}"):
            await mock_source_code_service.update(
                source_code_id=mocked_source_code.id,
                source_code=Mock(spec=SourceCodeUpdate),
                requester=mock_user_dto,
            )

    @pytest.mark.asyncio
    async def test_update_error(self, mock_source_code_crud, mocked_source_code, mock_user_dto):
        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_source_code_crud.update.side_effect = RuntimeError("update fail")

        with pytest.raises(RuntimeError) as exc:
            await mock_source_code_crud.update(
                source_code_id=mocked_source_code.id,
                source_code=Mock(spec=SourceCodeUpdate),
                requester=mock_user_dto,
            )

        assert str(exc.value) == "update fail"


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_success_disable_without_dependencies(
        self,
        mock_audit_log_handler,
        mock_event_sender,
        mock_source_code_service,
        monkeypatch,
        mock_user_dto,
        mocked_source_code,
        mock_source_code_crud,
        mocked_source_code_response,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)
        mocked_source_code.status = ModelStatus.DONE
        mocked_source_code_response.status = ModelStatus.DISABLED

        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_source_code_crud.get_dependencies.return_value = None
        monkeypatch.setattr(SourceCodeResponse, "model_validate", Mock(return_value=mocked_source_code_response))

        result = await mock_source_code_service.patch(
            source_code_id=mocked_source_code.id, body=patch_body, requester=mock_user_dto
        )

        assert result.status == ModelStatus.DISABLED
        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_source_code.id, mock_user_dto.id, ModelActions.DISABLE
        )
        response = SourceCodeResponse.model_validate(mocked_source_code_response)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DISABLE)

    @pytest.mark.asyncio
    @pytest.mark.parametrize("invalid_status", [ModelStatus.IN_PROGRESS, ModelStatus.DISABLED, ModelStatus.QUEUED])
    async def test_patch_sync_failure(
        self,
        invalid_status,
        mock_audit_log_handler,
        mock_event_sender,
        mock_source_code_service,
        mock_user_dto,
        mocked_source_code,
        mock_source_code_crud,
    ):
        patch_body = PatchBodyModel(action=ModelActions.SYNC)
        mocked_source_code.status = invalid_status
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(EntityWrongState) as exc:
            await mock_source_code_service.patch(
                source_code_id=mocked_source_code.id, body=patch_body, requester=mock_user_dto
            )

        assert str(exc.value).startswith("Entity has wrong status for syncing")

        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_crud.refresh.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_event_sender.send_event.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_patch_unsupported_action_error(
        self,
        mock_audit_log_handler,
        mock_event_sender,
        mock_source_code_service,
        mock_user_dto,
        mocked_source_code,
        mock_source_code_crud,
    ):
        patch_body = PatchBodyModel(action="super_provision")

        with pytest.raises(ValueError, match=f"Action {patch_body.action} is not supported"):
            await mock_source_code_service.patch(
                source_code_id=mocked_source_code.id, body=patch_body, requester=mock_user_dto
            )

        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_crud.refresh.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_event_sender.send_event.assert_not_awaited()


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mocked_source_code,
        mock_source_code_crud,
        mock_source_code_service,
        mock_user_dto,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mocked_source_code.status = ModelStatus.DISABLED

        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_source_code_crud.get_dependencies.return_value = []

        await mock_source_code_service.delete(source_code_id=mocked_source_code.id, requester=mock_user_dto)

        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_crud.delete.assert_awaited_once_with(mocked_source_code)
        mock_log_crud.delete_by_entity_id.assert_awaited_once_with(mocked_source_code.id)
        mock_revision_handler.delete_revisions.assert_awaited_once_with(mocked_source_code.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_source_code.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_task_entity_crud.delete_by_entity_id.assert_awaited_once_with(mocked_source_code.id)

    @pytest.mark.asyncio
    async def test_delete_not_found(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mock_user_dto,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mock_source_code_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="SourceCode not found"):
            await mock_source_code_service.delete(source_code_id="invalid_id", requester=mock_user_dto)

        mock_source_code_crud.get_by_id.assert_awaited_once_with("invalid_id")
        mock_source_code_crud.delete.assert_not_awaited()
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_error_wrong_state(
        self,
        mocked_source_code,
        mock_source_code_service,
        mock_source_code_crud,
        mock_user_dto,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mocked_source_code.status = ModelStatus.DONE
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(EntityWrongState) as exc:
            await mock_source_code_service.delete(source_code_id=mocked_source_code.id, requester=mock_user_dto)

        assert str(exc.value) == "Entity has wrong status for deletion ModelStatus.DONE"
        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_crud.delete.assert_not_awaited()
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_error_with_dependencies(
        self,
        mock_source_code_service,
        mock_user_dto,
        mocked_source_code,
        mock_source_code_crud,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mocked_source_code.status = ModelStatus.DISABLED

        dependency = Mock(id=uuid4(), name="Dependent Entity", type="source_code_version")

        mock_source_code_crud.get_by_id.return_value = mocked_source_code
        mock_source_code_crud.get_dependencies.return_value = [dependency]

        with pytest.raises(
            DependencyError,
            match="Cannot delete a source_code that has dependencies",
        ) as exc:
            await mock_source_code_service.delete(source_code_id=mocked_source_code.id, requester=mock_user_dto)

        assert len(exc.value.metadata) == 1
        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_crud.delete.assert_not_awaited()
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()


class TestGetIntegrationActions:
    @pytest.mark.asyncio
    async def test_get_actions_not_admin(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mocked_source_code,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["write"], monkeypatch, "application.source_codes.service.user_entity_permissions")
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        result = await mock_source_code_service.get_actions(
            source_code_id=mocked_source_code.id, requester=mock_user_dto
        )

        assert result == []
        mock_source_code_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_normal_state_admin(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mocked_source_code,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["admin"], monkeypatch, "application.source_codes.service.user_entity_permissions")
        existing_source_code = mocked_source_code
        existing_source_code.status = ModelStatus.READY
        mock_source_code_crud.get_by_id.return_value = existing_source_code

        result = await mock_source_code_service.get_actions(
            source_code_id=existing_source_code.id, requester=mock_user_dto
        )

        assert result == ["sync", ModelActions.EDIT, ModelActions.DISABLE]
        mock_source_code_crud.get_by_id.assert_awaited_once_with(existing_source_code.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_in_progress_admin(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mocked_source_code,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["admin"], monkeypatch, "application.source_codes.service.user_entity_permissions")
        existing_source_code = mocked_source_code
        existing_source_code.status = ModelStatus.IN_PROGRESS
        mock_source_code_crud.get_by_id.return_value = existing_source_code

        result = await mock_source_code_service.get_actions(
            source_code_id=existing_source_code.id, requester=mock_user_dto
        )

        assert result == []
        mock_source_code_crud.get_by_id.assert_awaited_once_with(existing_source_code.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_disabled_admin(
        self,
        mock_source_code_service,
        mock_source_code_crud,
        mocked_source_code,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["admin"], monkeypatch, "application.source_codes.service.user_entity_permissions")
        existing_source_code = mocked_source_code
        existing_source_code.status = ModelStatus.DISABLED
        mock_source_code_crud.get_by_id.return_value = existing_source_code

        result = await mock_source_code_service.get_actions(
            source_code_id=existing_source_code.id, requester=mock_user_dto
        )

        assert result == [ModelActions.ENABLE, ModelActions.DELETE]
        mock_source_code_crud.get_by_id.assert_awaited_once_with(existing_source_code.id)

    @pytest.mark.asyncio
    async def test_get_actions_user_has_read_permissions(
        self,
        mock_source_code_service,
        mocked_source_code,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["read"], monkeypatch, "application.source_codes.service.user_entity_permissions")

        result = await mock_source_code_service.get_actions(
            source_code_id=mocked_source_code.id, requester=mock_user_dto
        )

        assert result == []
