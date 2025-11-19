from unittest.mock import Mock
from uuid import uuid4

import pytest
from pydantic import PydanticUserError

from application.source_code_versions.model import SourceCodeVersion
from application.source_code_versions.schema import (
    SourceCodeVersionCreate,
    SourceCodeVersionResponse,
    SourceCodeVersionUpdate,
)
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions, ModelStatus
from core.errors import DependencyError, EntityNotFound, EntityWrongState

SOURCE_CODE_ID = "1985435id-1234-5678-90ab-cdef12345678"


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        monkeypatch,
        source_code_version,
        source_code_version_response,
    ):
        mock_source_code_version_crud.get_by_id.return_value = source_code_version
        monkeypatch.setattr(
            SourceCodeVersionResponse, "model_validate", Mock(return_value=source_code_version_response)
        )

        result = await mock_source_code_version_service.get_by_id(source_code_version.id)

        assert result == source_code_version_response
        mock_source_code_version_crud.get_by_id.assert_called_once_with(source_code_version.id)

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.get_by_id.return_value = None

        result = await mock_source_code_version_service.get_by_id("invalid_id")

        assert result is None
        mock_source_code_version_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_empty(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.get_by_id.return_value = None

        result = await mock_source_code_version_service.get_by_id(SOURCE_CODE_ID)
        assert result is None
        mock_source_code_version_crud.get_by_id.assert_awaited_once_with(SOURCE_CODE_ID)

    @pytest.mark.asyncio
    async def test_get_by_id_error(
        self, mock_source_code_version_service, mock_source_code_version_crud, monkeypatch, source_code_version
    ):
        mock_source_code_version_crud.get_by_id.return_value = source_code_version

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SourceCodeVersionResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_source_code_version_service.get_by_id(source_code_version.id)

        assert exc.value is error
        assert exc.value.message == error.message
        mock_source_code_version_crud.get_by_id.assert_called_once_with(source_code_version.id)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        monkeypatch,
        many_source_code_version_response,
    ):
        mock_source_code_version_crud.get_all.return_value = many_source_code_version_response

        def mock_model_validate(arg):
            return arg

        monkeypatch.setattr(SourceCodeVersionResponse, "model_validate", mock_model_validate)

        result = await mock_source_code_version_service.get_all(limit=5)

        assert result == many_source_code_version_response
        mock_source_code_version_crud.get_all.assert_awaited_once_with(limit=5)

    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.get_all.return_value = []

        result = await mock_source_code_version_service.get_all(limit=5)

        assert not result
        mock_source_code_version_crud.get_all.assert_awaited_once_with(limit=5)

    @pytest.mark.asyncio
    async def test_get_all_error(
        self, mock_source_code_version_service, mock_source_code_version_crud, monkeypatch, mocked_source_code
    ):
        mock_source_code_version_crud.get_all.return_value = [mocked_source_code]
        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SourceCodeVersionResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_source_code_version_service.get_all(limit=5)

        assert exc.value is error
        mock_source_code_version_crud.get_all.assert_awaited_once_with(limit=5)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.count.return_value = 5

        result = await mock_source_code_version_service.count(filter={"key": "value"})

        assert result == 5
        mock_source_code_version_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_source_code_version_service, mock_source_code_version_crud):
        mock_source_code_version_crud.count.side_effect = RuntimeError("DB error")

        with pytest.raises(RuntimeError) as exc:
            await mock_source_code_version_service.count(filter={"key": "value"})

        assert isinstance(exc.value, RuntimeError)
        assert str(exc.value) == "DB error"
        mock_source_code_version_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mock_source_code_crud,
        mocked_source_code,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mock_template_crud,
        mocked_template,
        monkeypatch,
        source_code_version,
        source_code_version_response,
        mock_user_dto,
        mocked_user_response,
        template_response,
        mocked_source_code_response,
    ):
        source_code_version_to_create_body = {
            "source_code_folder": "test_folder",
            "source_code_version": "v0.1",
            "source_code_id": str(source_code_version.source_code_id),
            "template_id": str(source_code_version.template_id),
            "labels": ["label1", "label2"],
        }

        mocked_template.status = ModelStatus.ENABLED
        mocked_source_code.status = ModelStatus.DONE
        mock_template_crud.get_by_id.return_value = mocked_template
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        mocked_source_code_version_create = Mock(spec=SourceCodeVersionCreate)
        mocked_source_code_version_create.source_code_folder = source_code_version_to_create_body["source_code_folder"]
        mocked_source_code_version_create.source_code_branch = None
        mocked_source_code_version_create.source_code_version = source_code_version_to_create_body[
            "source_code_version"
        ]
        mocked_source_code_version_create.source_code_id = source_code_version_to_create_body["source_code_id"]
        mocked_source_code_version_create.template_id = source_code_version_to_create_body["template_id"]
        mocked_source_code_version_create.labels = source_code_version_to_create_body["labels"]

        mocked_source_code_version_create.model_dump = Mock(return_value=source_code_version_to_create_body)

        created_source_code_version = SourceCodeVersion(id=source_code_version.id, **source_code_version_to_create_body)
        scv_response = SourceCodeVersionResponse(
            id=created_source_code_version.id,
            source_code_folder=created_source_code_version.source_code_folder,
            source_code_version=created_source_code_version.source_code_version,
            labels=created_source_code_version.labels,
            creator=mocked_user_response,
            template=template_response,
            source_code=mocked_source_code_response,
        )

        mock_source_code_version_crud.create.return_value = created_source_code_version
        mock_source_code_version_crud.get_by_id.return_value = created_source_code_version

        monkeypatch.setattr(SourceCodeVersionResponse, "model_validate", Mock(return_value=scv_response))

        saved_source_code_version = await mock_source_code_version_service.create(
            source_code_version=mocked_source_code_version_create, requester=mock_user_dto
        )

        mocked_source_code_version_create.model_dump.assert_called_once_with(exclude_unset=True)
        mock_source_code_version_crud.create.assert_awaited_once_with(source_code_version_to_create_body)

        assert created_source_code_version.status == ModelStatus.READY

        mock_revision_handler.handle_revision.assert_called_once_with(created_source_code_version)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            created_source_code_version.id, mock_user_dto.id, ModelActions.CREATE
        )
        response = SourceCodeVersionResponse.model_validate(source_code_version_response)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.CREATE)

        assert saved_source_code_version.source_code_folder == source_code_version_to_create_body["source_code_folder"]
        assert (
            saved_source_code_version.source_code_version == source_code_version_to_create_body["source_code_version"]
        )

    @pytest.mark.asyncio
    async def test_create_invalid_template_state(
        self, mock_source_code_version_service, mock_template_crud, mocked_template, mock_user_dto
    ):
        mocked_template.status = ModelStatus.DISABLED
        mock_template_crud.get_by_id.return_value = mocked_template

        source_code_version_to_create_body = {
            "source_code_folder": "test_folder",
            "source_code_version": "v0.1",
            "source_code_id": SOURCE_CODE_ID,
            "template_id": str(mocked_template.id),
            "labels": ["label1", "label2"],
        }

        mocked_source_code_version_create = Mock(spec=SourceCodeVersionCreate)
        mocked_source_code_version_create.source_code_folder = source_code_version_to_create_body["source_code_folder"]
        mocked_source_code_version_create.source_code_branch = None
        mocked_source_code_version_create.source_code_version = source_code_version_to_create_body[
            "source_code_version"
        ]
        mocked_source_code_version_create.source_code_id = source_code_version_to_create_body["source_code_id"]
        mocked_source_code_version_create.template_id = source_code_version_to_create_body["template_id"]
        mocked_source_code_version_create.labels = source_code_version_to_create_body["labels"]

        with pytest.raises(EntityWrongState, match="Template is not enabled"):
            await mock_source_code_version_service.create(
                source_code_version=mocked_source_code_version_create, requester=mock_user_dto
            )

    @pytest.mark.asyncio
    async def test_create_invalid_source_code_state(
        self,
        mock_source_code_version_service,
        mock_template_crud,
        mock_source_code_crud,
        mocked_source_code,
        mocked_template,
        mock_user_dto,
    ):
        mocked_template.status = ModelStatus.ENABLED
        mock_template_crud.get_by_id.return_value = mocked_template
        mocked_source_code.status = ModelStatus.DISABLED
        mock_source_code_crud.get_by_id.return_value = mocked_source_code

        source_code_version_to_create_body = {
            "source_code_folder": "test_folder",
            "source_code_version": "v0.1",
            "source_code_id": mocked_source_code.id,
            "template_id": mocked_template.id,
            "labels": ["label1", "label2"],
        }

        mocked_source_code_version_create = Mock(spec=SourceCodeVersionCreate)
        mocked_source_code_version_create.source_code_folder = source_code_version_to_create_body["source_code_folder"]
        mocked_source_code_version_create.source_code_branch = None
        mocked_source_code_version_create.source_code_version = source_code_version_to_create_body[
            "source_code_version"
        ]
        mocked_source_code_version_create.source_code_id = source_code_version_to_create_body["source_code_id"]
        mocked_source_code_version_create.template_id = source_code_version_to_create_body["template_id"]
        mocked_source_code_version_create.labels = source_code_version_to_create_body["labels"]

        with pytest.raises(EntityWrongState, match="SourceCode is not enabled"):
            await mock_source_code_version_service.create(
                source_code_version=mocked_source_code_version_create, requester=mock_user_dto
            )


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
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

        mocked_source_code_update = Mock(spec=SourceCodeVersionUpdate)
        mocked_source_code_update.model_dump = Mock(return_value=update_body)

        existing_source_code = mocked_source_code
        existing_source_code.status = ModelStatus.DONE

        updated_source_code = mocked_source_code
        updated_source_code.description = update_body["description"]

        updated_source_code_response = mocked_source_code_response
        updated_source_code_response.description = update_body["description"]
        updated_source_code_response.status = ModelStatus.READY

        mock_source_code_version_crud.update.return_value = updated_source_code
        mock_source_code_version_crud.get_by_id.return_value = existing_source_code

        monkeypatch.setattr(
            SourceCodeVersionResponse, "model_validate", Mock(return_value=updated_source_code_response)
        )

        result = await mock_source_code_version_service.update(
            source_code_version_id=existing_source_code.id,
            source_code_version=mocked_source_code_update,
            requester=mock_user_dto,
        )

        mocked_source_code_update.model_dump.assert_called_once_with(exclude_unset=True)
        mock_source_code_version_crud.update.assert_awaited_once_with(existing_source_code, update_body)
        mock_source_code_version_crud.refresh.assert_called_once_with(updated_source_code)
        mock_audit_log_handler.create_log.assert_awaited_once_with(updated_source_code.id, mock_user_dto.id, "update")
        mock_revision_handler.handle_revision.assert_called_once_with(existing_source_code)
        response = SourceCodeVersionResponse.model_validate(updated_source_code_response)
        mock_event_sender.send_event.assert_awaited_once_with(response, "update")

        assert result.status == ModelStatus.READY

    @pytest.mark.asyncio
    async def test_update_not_found(
        self, mock_source_code_version_service, mock_source_code_version_crud, mock_user_dto
    ):
        source_code_update = Mock(spec=SourceCodeVersionUpdate)
        mock_source_code_version_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="SourceCodeVersion not found"):
            await mock_source_code_version_service.update(
                source_code_version_id="123id", source_code_version=source_code_update, requester=mock_user_dto
            )

    @pytest.mark.asyncio
    async def test_update_source_code_has_invalid_status(
        self, mock_source_code_version_service, mock_source_code_version_crud, mock_user_dto, mocked_source_code
    ):
        mocked_source_code.status = ModelStatus.IN_PROGRESS
        mock_source_code_version_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(ValueError, match=r"Entity has wrong status for updating ModelStatus.IN_PROGRESS"):
            await mock_source_code_version_service.update(
                source_code_version_id=mocked_source_code.id,
                source_code_version=Mock(spec=SourceCodeVersionUpdate),
                requester=mock_user_dto,
            )

    @pytest.mark.asyncio
    async def test_update_error(self, mock_source_code_version_crud, mocked_source_code, mock_user_dto):
        mock_source_code_version_crud.get_by_id.return_value = mocked_source_code
        mock_source_code_version_crud.update.side_effect = RuntimeError("update fail")

        with pytest.raises(RuntimeError) as exc:
            await mock_source_code_version_crud.update(
                source_code_version_id=mocked_source_code.id,
                source_code_version=Mock(spec=SourceCodeVersionUpdate),
                requester=mock_user_dto,
            )

        assert str(exc.value) == "update fail"


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_success_disable_without_dependencies(
        self,
        mock_audit_log_handler,
        mock_event_sender,
        mock_source_code_version_service,
        mock_user_dto,
        source_code_version,
        mock_source_code_version_crud,
    ):
        patch_body = PatchBodyModel(action=ModelActions.DISABLE)

        mock_source_code_version_crud.get_by_id.return_value = source_code_version
        mock_source_code_version_crud.get_dependencies.return_value = None

        result = await mock_source_code_version_service.patch(
            source_code_version_id=source_code_version.id, body=patch_body, requester=mock_user_dto
        )

        assert result.status == ModelStatus.DISABLED
        mock_source_code_version_crud.get_by_id.assert_awaited_once_with(source_code_version.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            source_code_version.id, mock_user_dto.id, ModelActions.DISABLE
        )
        response = SourceCodeVersionResponse.model_validate(source_code_version)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DISABLE)

    @pytest.mark.asyncio
    async def test_patch_sync_failure(
        self,
        mock_audit_log_handler,
        mock_event_sender,
        mock_source_code_version_service,
        mock_user_dto,
        mocked_source_code,
        mock_source_code_version_crud,
    ):
        patch_body = PatchBodyModel(action=ModelActions.SYNC)
        mocked_source_code.status = ModelStatus.IN_PROGRESS
        mock_source_code_version_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(EntityWrongState) as exc:
            await mock_source_code_version_service.patch(
                source_code_version_id=mocked_source_code.id, body=patch_body, requester=mock_user_dto
            )

        assert str(exc.value).startswith("Entity has wrong status for syncing")

        mock_source_code_version_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_version_crud.refresh.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_event_sender.send_event.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_patch_unsupported_action_error(
        self,
        mock_audit_log_handler,
        mock_event_sender,
        mock_source_code_version_service,
        mock_user_dto,
        mocked_source_code,
        mock_source_code_version_crud,
    ):
        patch_body = PatchBodyModel(action="super_provision")

        with pytest.raises(ValueError, match=f"Action {patch_body.action} is not supported"):
            await mock_source_code_version_service.patch(
                source_code_version_id=mocked_source_code.id, body=patch_body, requester=mock_user_dto
            )

        mock_source_code_version_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_version_crud.refresh.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_awaited_once()
        mock_event_sender.send_event.assert_not_awaited()


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        source_code_version,
        mock_source_code_version_crud,
        mock_source_code_version_service,
        mock_user_dto,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        source_code_version.status = ModelStatus.DISABLED
        mock_source_code_version_crud.get_by_id.return_value = source_code_version
        mock_source_code_version_crud.get_dependencies.return_value = []

        await mock_source_code_version_service.delete(
            source_code_version_id=source_code_version.id, requester=mock_user_dto
        )

        mock_source_code_version_crud.get_by_id.assert_awaited_once_with(source_code_version.id)
        mock_source_code_version_crud.delete.assert_awaited_once_with(source_code_version)
        mock_log_crud.delete_by_entity_id.assert_awaited_once_with(source_code_version.id)
        mock_revision_handler.delete_revisions.assert_awaited_once_with(source_code_version.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            source_code_version.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_task_entity_crud.delete_by_entity_id.assert_awaited_once_with(source_code_version.id)

    @pytest.mark.asyncio
    async def test_delete_not_found(
        self,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mock_user_dto,
        mock_log_crud,
        mock_audit_log_handler,
        mock_revision_handler,
    ):
        mock_source_code_version_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="SourceCodeVersion not found"):
            await mock_source_code_version_service.delete(source_code_version_id="invalid_id", requester=mock_user_dto)

        mock_source_code_version_crud.get_by_id.assert_awaited_once_with("invalid_id")
        mock_source_code_version_crud.delete.assert_not_awaited()
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_error_wrong_state(
        self,
        mocked_source_code,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mock_user_dto,
        mock_log_crud,
        mock_audit_log_handler,
        mock_revision_handler,
    ):
        mocked_source_code.status = ModelStatus.DONE
        mock_source_code_version_crud.get_by_id.return_value = mocked_source_code

        with pytest.raises(EntityWrongState) as exc:
            await mock_source_code_version_service.delete(
                source_code_version_id=mocked_source_code.id, requester=mock_user_dto
            )

        assert str(exc.value) == "Entity has wrong status for deleting ModelStatus.DONE"
        mock_source_code_version_crud.get_by_id.assert_awaited_once_with(mocked_source_code.id)
        mock_source_code_version_crud.delete.assert_not_awaited()
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_error_dependencies(
        self,
        mocked_source_code,
        mock_source_code_version_service,
        mock_source_code_version_crud,
        mock_user_dto,
        mock_log_crud,
        mock_audit_log_handler,
        mock_revision_handler,
    ):
        mocked_source_code.status = ModelStatus.DISABLED
        dependency = Mock(id=uuid4(), name="Dependent Resource", type="resource")
        mock_source_code_version_crud.get_by_id.return_value = mocked_source_code
        mock_source_code_version_crud.get_dependencies.return_value = [dependency]

        with pytest.raises(DependencyError, match="Cannot delete a source_code_version that has dependencies"):
            await mock_source_code_version_service.delete(
                source_code_version_id=mocked_source_code.id, requester=mock_user_dto
            )

        mock_source_code_version_crud.delete.assert_not_awaited()
        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
