# pyright: reportAttributeAccessIssue=false, reportOptionalMemberAccess=false, reportAssignmentType=false
from datetime import datetime
from unittest.mock import Mock, AsyncMock
from uuid import uuid4

import pytest
from pydantic import PydanticUserError, ValidationError

from application.integrations.model import Integration
from application.integrations.schema import (
    IntegrationResponse,
    IntegrationCreate,
    IntegrationUpdate,
    IntegrationValidationResponse,
)
from core import EncryptedSecretStr
from core.base_models import PatchBodyModel
from core.constants import ModelStatus
from core.constants.model import ModelActions
from core.errors import CloudWrongCredentials, DependencyError, EntityNotFound, EntityWrongState
from core.users.model import User

INTEGRATION_ID = "b7e2c1a2-4f3a-4e2d-9c1b-8e2f7a6d5c3b"
ENCRYPTION_KEY = "TzIxN0hkbHN0SllDOEw4eWlxTERsb0xpZ0s3enRCM1hUdWxUamx1VHpVTT0=\n"
ENCRYPTED_SECRET = (
    "gAAAAABobl0aGntluKp6zDEk3keTzurHVa7JG0jQrH0tetUq11vn_axIez2H4Iig5Zjrv8Bke4Miy0CPGX4EKAqm3BdPTIgtUQ=="
)


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.get_by_id.return_value = None

        result = await mock_integration_service.get_by_id("invalid_id")

        assert result is None
        mock_integration_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
    ):
        mock_integration_crud.get_by_id.return_value = mocked_integration
        result = await mock_integration_service.get_by_id(mocked_integration.id)
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)
        assert isinstance(result, IntegrationResponse)

    @pytest.mark.asyncio
    async def test_get_by_id_empty(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.get_by_id.return_value = None

        result = await mock_integration_service.get_by_id(INTEGRATION_ID)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_by_id_error(
        self, mock_integration_service, mock_integration_crud, monkeypatch, mocked_integration
    ):
        mock_integration_crud.get_by_id.return_value = mocked_integration
        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(IntegrationResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_integration_service.get_by_id(mocked_integration.id)

        assert exc.value is error
        assert exc.value.message == "Error message"
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.get_all.return_value = []

        result = await mock_integration_service.get_all(limit=3)

        assert result == []
        mock_integration_crud.get_all.assert_awaited_once_with(limit=3)

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_integration_service, mock_integration_crud, monkeypatch):
        integrations = [
            Integration(id=uuid4(), name="integration 1"),
            Integration(id=uuid4(), name="integration 2"),
        ]
        mock_integration_crud.get_all.return_value = integrations

        def mock_model_validate(arg):
            return next((i for i in integrations if i.name == arg.name), None)

        monkeypatch.setattr(IntegrationResponse, "model_validate", mock_model_validate)

        result = await mock_integration_service.get_all(limit=5)

        assert result == integrations
        mock_integration_crud.get_all.assert_awaited_once_with(limit=5)

    @pytest.mark.asyncio
    async def test_get_all_error(
        self, mock_integration_service, mock_integration_crud, monkeypatch, mocked_integration
    ):
        mock_integration_crud.get_all.return_value = [mocked_integration]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(IntegrationResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_integration_service.get_all(limit=5)

        assert exc.value is error
        mock_integration_crud.get_all.assert_awaited_once_with(limit=5)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.count.return_value = 1

        result = await mock_integration_service.count(filter={"key": "value"})

        assert result == 1
        mock_integration_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_integration_service, mock_integration_crud):
        mock_integration_crud.count.side_effect = RuntimeError("DB error")

        with pytest.raises(RuntimeError) as exc:
            await mock_integration_service.count(filter={"key": "value"})

        assert str(exc.value) == "DB error"
        mock_integration_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_integration_service,
        mock_integration_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_integration,
        mocked_integration_response,
        mock_user_dto,
    ):
        cloud_integration_config = {
            "aws_account": "123456789012",
            "aws_access_key_id": "test_access_key",
            "aws_secret_access_key": "test_secret",
            "integration_provider": "aws",
        }

        integration_body = {
            "name": "Test Integration",
            "description": "Test description",
            "integration_type": "cloud",
            "integration_provider": "aws",
            "configuration": cloud_integration_config,
        }

        expected_integration_body = {
            **integration_body,
            "created_by": mock_user_dto.id,
        }

        integration_create = Mock(spec=IntegrationCreate)
        integration_create.integration_type = "cloud"
        integration_create.integration_provider = "aws"
        integration_create.model_dump = Mock(return_value=integration_body)

        new_integration = Integration(name="Test Integration", integration_type="cloud", integration_provider="aws")
        mock_integration_crud.create.return_value = new_integration
        mock_integration_crud.get_by_id.return_value = mocked_integration

        monkeypatch.setattr(IntegrationResponse, "model_validate", Mock(return_value=mocked_integration_response))

        created_integration = await mock_integration_service.create(
            integration=integration_create, requester=mock_user_dto
        )

        integration_create.model_dump.assert_called_once_with(by_alias=True, exclude={"_entity_name"})
        mock_integration_crud.create.assert_awaited_once_with(expected_integration_body)

        assert created_integration.status == ModelStatus.ENABLED

        mock_revision_handler.handle_revision.assert_awaited_once_with(new_integration)
        mock_audit_log_handler.create_log.assert_awaited_once_with(new_integration.id, mock_user_dto.id, "create")
        response = IntegrationResponse.model_validate(new_integration)
        mock_event_sender.send_event.assert_awaited_once_with(response, "create")

        assert created_integration.name == "Test Integration"
        assert created_integration.configuration.aws_access_key_id == cloud_integration_config["aws_access_key_id"]

    @pytest.mark.asyncio
    async def test_create_unsupported_cloud_provider(
        self,
        mock_integration_service,
        mock_integration_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mock_user_dto,
    ):
        integration_body = {
            "name": "Test Integration",
            "description": "Test description",
            "integration_type": "cloud",
            "integration_provider": "invalid_provider",
            "configuration": {},
        }

        integration_create = Mock(spec=IntegrationCreate)
        integration_create.integration_type = "cloud"
        integration_create.integration_provider = "invalid_provider"
        integration_create.model_dump = Mock(return_value=integration_body)

        with pytest.raises(
            ValueError,
            match="Invalid integration provider, must be one of",
        ):
            await mock_integration_service.create(integration_create, mock_user_dto)

        integration_create.model_dump.assert_not_called()
        mock_integration_crud.assert_not_called()
        mock_event_sender.assert_not_called()
        mock_audit_log_handler.assert_not_called()
        mock_revision_handler.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_invalid_git_provider(
        self,
        mock_integration_service,
        mock_integration_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mock_user_dto,
    ):
        integration_body = {
            "name": "Test Integration",
            "description": "Test description",
            "integration_type": "git",
            "integration_provider": "invalid_git_provider",
            "configuration": {},
        }

        integration_create = Mock(spec=IntegrationCreate)
        integration_create.integration_type = "git"
        integration_create.integration_provider = "invalid_git_provider"
        integration_create.model_dump = Mock(return_value=integration_body)

        with pytest.raises(ValueError, match="Invalid integration provider, must be one of"):
            await mock_integration_service.create(integration_create, mock_user_dto)

        integration_create.model_dump.assert_not_called()
        mock_integration_crud.assert_not_called()
        mock_event_sender.assert_not_called()
        mock_audit_log_handler.assert_not_called()
        mock_revision_handler.assert_not_called()

    @pytest.mark.asyncio
    async def test_create_invalid_configuration(
        self,
    ):
        # integration_provider in configuration does not match top-level integration_provider
        integration_body = {
            "name": "Test Integration",
            "description": "Test description",
            "integration_type": "git",
            "integration_provider": "github_ssh",
            "configuration": {
                "github_ssh_private_key": "some_key",
                "integration_provider": "github",
            },
        }

        with pytest.raises(ValidationError, match="validation error for IntegrationCreate"):
            IntegrationCreate.model_validate(integration_body)


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_integration_service,
        mock_integration_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_integration,
        mocked_integration_response,
        mock_user_dto,
    ):
        aws_integration_config = {
            "aws_account": "123456789012",
            "aws_access_key_id": "updated",
            "aws_secret_access_key": "******",
        }

        integration_update = Mock(spec=IntegrationUpdate)
        integration_update.name = "New Integration name"
        integration_update.description = "Updated description"
        integration_update.integration_type = "cloud"
        integration_update.integration_provider = "aws"
        integration_update.configuration = aws_integration_config

        mocked_integration.status = ModelStatus.ENABLED
        mocked_integration.name = "New Integration name"

        mocked_integration_response.status = ModelStatus.ENABLED
        mocked_integration_response.name = "New Integration name"

        update_integration_body = {
            "name": "New Integration name",
            "created_by": "user1",
            "description": "Test description",
            "integration_type": "cloud",
            "integration_provider": "aws",
            "configuration": aws_integration_config,
        }

        integration_update.model_dump = Mock(return_value=update_integration_body)
        mock_integration_crud.get_by_id.return_value = mocked_integration
        mock_integration_crud.update.return_value = mocked_integration

        monkeypatch.setattr(IntegrationResponse, "model_validate", Mock(return_value=mocked_integration_response))
        monkeypatch.setattr(mock_integration_service, "validate_configuration", Mock())

        integration_update_result = await mock_integration_service.update(
            integration_id=mocked_integration.id, integration=integration_update, requester=mock_user_dto
        )

        integration_update.model_dump.assert_called_once_with(by_alias=True, exclude={"_entity_name"})
        mock_integration_crud.update.assert_called_once_with(mocked_integration, update_integration_body)

        mock_integration_crud.refresh.assert_called_once_with(mocked_integration)
        mock_audit_log_handler.create_log.assert_awaited_once_with(mocked_integration.id, mock_user_dto.id, "update")
        mock_revision_handler.handle_revision.assert_awaited_once_with(mocked_integration)
        response = IntegrationResponse.model_validate(mocked_integration)
        mock_event_sender.send_event.assert_awaited_once_with(response, "update")

        assert integration_update_result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_update_not_found(self, mock_integration_service, mock_integration_crud, mock_user_dto):
        integration_update = Mock(spec=IntegrationUpdate)
        mock_integration_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Integration not found"):
            await mock_integration_service.update(
                integration_id="123id", integration=integration_update, requester=mock_user_dto
            )

    @pytest.mark.asyncio
    async def test_update_integration_has_status_disabled(
        self,
        mock_integration_service,
        mock_integration_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_integration,
        mocked_integration_response,
        mock_user_dto,
    ):
        aws_integration_config = {"aws_account": "123456789012", "aws_access_key_id": "updated"}

        integration_update = Mock(spec=IntegrationUpdate)
        integration_update.name = "New Integration name"
        integration_update.description = "Updated description"
        integration_update.integration_type = "cloud"
        integration_update.integration_provider = "aws"
        integration_update.configuration = aws_integration_config

        mocked_integration.status = ModelStatus.DISABLED
        mocked_integration.name = "New Integration name"

        mocked_integration_response.status = ModelStatus.ENABLED
        mocked_integration_response.name = "New Integration name"

        update_integration_body = {
            "name": "New Integration name",
            "created_by": "user1",
            "description": "Test description",
            "integration_type": "cloud",
            "integration_provider": "aws",
            "configuration": aws_integration_config,
        }

        integration_update.model_dump = Mock(return_value=update_integration_body)
        mock_integration_crud.get_by_id.return_value = mocked_integration
        mock_integration_crud.update.return_value = mocked_integration

        monkeypatch.setattr(IntegrationResponse, "model_validate", Mock(return_value=mocked_integration_response))
        monkeypatch.setattr(mock_integration_service, "validate_configuration", Mock())

        integration_update_result = await mock_integration_service.update(
            integration_id=mocked_integration.id, integration=integration_update, requester=mock_user_dto
        )

        integration_update.model_dump.assert_called_once_with(by_alias=True, exclude={"_entity_name"})
        mock_integration_crud.update.assert_called_once_with(mocked_integration, update_integration_body)
        mock_integration_crud.refresh.assert_called_once_with(mocked_integration)
        mock_audit_log_handler.create_log.assert_awaited_once_with(mocked_integration.id, mock_user_dto.id, "update")
        mock_revision_handler.handle_revision.assert_awaited_once_with(mocked_integration)
        response = IntegrationResponse.model_validate(mocked_integration)
        mock_event_sender.send_event.assert_awaited_once_with(response, "update")

        assert integration_update_result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_update_error(
        self, mock_integration_service, mock_integration_crud, mocked_integration, mock_user_dto, monkeypatch
    ):
        integration_update = Mock(spec=IntegrationUpdate)
        mock_integration_crud.get_by_id.return_value = mocked_integration
        mock_integration_crud.update.side_effect = RuntimeError("update fail")

        monkeypatch.setattr(mock_integration_service, "validate_configuration", Mock())

        with pytest.raises(RuntimeError, match="update fail") as exc:
            await mock_integration_service.update(
                integration_id=INTEGRATION_ID, integration=integration_update, requester=mock_user_dto
            )

        assert isinstance(exc.value, RuntimeError)


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_success_with_status_disable(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        mocked_integration_response,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mock_user_dto,
    ):
        mocked_integration.status = ModelStatus.ENABLED
        mocked_integration_response.status = ModelStatus.DISABLED

        mock_integration_crud.get_by_id.return_value = mocked_integration
        mock_integration_crud.get_dependencies.return_value = []
        monkeypatch.setattr(IntegrationResponse, "model_validate", Mock(return_value=mocked_integration_response))

        result = await mock_integration_service.patch(
            integration_id=INTEGRATION_ID, body=PatchBodyModel(action=ModelActions.DISABLE), requester=mock_user_dto
        )

        mock_integration_crud.get_by_id.assert_awaited_once_with(INTEGRATION_ID)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_integration.id, mock_user_dto.id, ModelActions.DISABLE
        )
        response = IntegrationResponse.model_validate(mocked_integration)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DISABLE)
        assert result.status == ModelStatus.DISABLED

    @pytest.mark.asyncio
    async def test_patch_integration_not_found(self, mock_integration_service, mock_integration_crud, mock_user_dto):
        mock_integration_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Integration not found"):
            await mock_integration_service.patch(
                integration_id=INTEGRATION_ID, body=PatchBodyModel(action=ModelActions.APPROVE), requester=mock_user_dto
            )


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        mock_user_dto,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mocked_integration.status = ModelStatus.DISABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration
        mock_integration_crud.get_dependencies.return_value = []

        await mock_integration_service.delete(integration_id=mocked_integration.id, requester=mock_user_dto)

        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)
        mock_integration_crud.delete.assert_awaited_once_with(mocked_integration)
        mock_revision_handler.delete_revisions.assert_awaited_once_with(mocked_integration.id)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_integration.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_task_entity_crud.delete_by_entity_id.assert_awaited_once_with(mocked_integration.id)

    @pytest.mark.asyncio
    async def test_delete_error_enabled(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        mock_user_dto,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mocked_integration.status = ModelStatus.ENABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration

        with pytest.raises(EntityWrongState, match="Integration must be disabled before deletion"):
            await mock_integration_service.delete(integration_id=mocked_integration.id, requester=mock_user_dto)

        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)
        mock_integration_crud.delete.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_error_has_dependencies(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        mock_user_dto,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        dependency = Mock(id=uuid4(), name="dependency_integration", type="resource")
        mocked_integration.status = ModelStatus.DISABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration
        mock_integration_crud.get_dependencies.return_value = [dependency]

        with pytest.raises(DependencyError, match="Cannot delete integration, it is used by 1 entities") as exc:
            await mock_integration_service.delete(integration_id=mocked_integration.id, requester=mock_user_dto)

        assert exc.value.error_code == "DEPENDENCY_ERROR"
        assert len(exc.value.metadata) == 1
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)
        mock_integration_crud.delete.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()

    @pytest.mark.asyncio
    async def test_delete_not_found(
        self,
        mock_integration_service,
        mock_integration_crud,
        mock_user_dto,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        mock_integration_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Integration not found"):
            await mock_integration_service.delete(integration_id=INTEGRATION_ID, requester=mock_user_dto)
        mock_integration_crud.get_by_id.assert_awaited_once_with(INTEGRATION_ID)
        mock_integration_crud.delete.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()


class TestGetIntegrationActions:
    @pytest.mark.asyncio
    async def test_get_actions_for_enabled_not_admin(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(
            ["write"],
            monkeypatch,
            "application.integrations.service.user_entity_permissions",
        )

        mocked_integration.status = ModelStatus.ENABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration

        result = await mock_integration_service.get_actions(
            integration_id=mocked_integration.id, requester=mock_user_dto
        )

        assert result == []
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_enabled_admin(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(
            ["write", "admin"], monkeypatch, "application.integrations.service.user_entity_permissions"
        )

        existing_integration = mocked_integration
        existing_integration.status = ModelStatus.ENABLED
        mock_integration_crud.get_by_id.return_value = existing_integration

        result = await mock_integration_service.get_actions(
            integration_id=mocked_integration.id, requester=mock_user_dto
        )

        assert result == [ModelActions.EDIT, ModelActions.DISABLE]
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_disabled_not_admin(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["write"], monkeypatch, "application.integrations.service.user_entity_permissions")

        mocked_integration.status = ModelStatus.DISABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration

        result = await mock_integration_service.get_actions(
            integration_id=mocked_integration.id, requester=mock_user_dto
        )

        assert result == []
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_disabled_admin(
        self,
        mock_integration_service,
        mock_integration_crud,
        mocked_integration,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(
            ["write", "admin"], monkeypatch, "application.integrations.service.user_entity_permissions"
        )

        mocked_integration.status = ModelStatus.DISABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration

        result = await mock_integration_service.get_actions(
            integration_id=mocked_integration.id, requester=mock_user_dto
        )

        assert result == [ModelActions.DELETE, ModelActions.ENABLE]
        mock_integration_crud.get_by_id.assert_awaited_once_with(mocked_integration.id)

    @pytest.mark.asyncio
    async def test_get_actions_user_has_read_permissions(
        self,
        mock_integration_service,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["read"], monkeypatch, "application.integrations.service.user_entity_permissions")

        result = await mock_integration_service.get_actions(integration_id=INTEGRATION_ID, requester=mock_user_dto)

        assert result == []


class TestValidateConfiguration:
    def test_validate_configuration_with_default_masked_secret(self, mock_integration_service, monkeypatch):
        monkeypatch.setenv("ENCRYPTION_KEY", ENCRYPTION_KEY)

        integration_update_json_str = """
            {
                "name": "bitbucket_dev_account",
                "description": "Changed description",
                "labels": [
                    "bitbucket"
                ],
                "configuration": {
                    "bitbucket_user": "test_user_dev@example.com",
                    "bitbucket_key": "**********",
                    "integration_provider": "bitbucket"
                }
            }
        """
        integration_update = IntegrationUpdate.model_validate_json(integration_update_json_str)
        initial_secret_value = integration_update.configuration.bitbucket_key

        existing_integration = Integration(
            id=uuid4(),
            name="bitbucket_dev_account",
            description="Initial_description",
            integration_type="cloud",
            integration_provider="bitbucket",
            configuration={
                "bitbucket_user": "test_user_dev@example.com",
                "bitbucket_key": f"EncryptedSecretStr:${ENCRYPTED_SECRET}",
                "integration_provider": "bitbucket",
            },
            labels=["bitbucket"],
            creator=User(),
            status=ModelStatus.ENABLED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=uuid4(),
            revision_number=1,
        )

        mock_integration_service.validate_configuration(
            integration_update=integration_update, existing_integration=existing_integration
        )

        updated_secret_value: EncryptedSecretStr = integration_update.configuration.bitbucket_key

        assert initial_secret_value.get_decrypted_value() == "**********"
        assert updated_secret_value.get_decrypted_value() == "test_key_dev"

    def test_validate_configuration_with_updated_secret(self, mock_integration_service, monkeypatch):
        monkeypatch.setenv("ENCRYPTION_KEY", ENCRYPTION_KEY)

        integration_update_json_str = """
            {
                "name": "bitbucket_dev_account",
                "description": "Changed description",
                "labels": [
                    "bitbucket"
                ],
                "configuration": {
                    "bitbucket_user": "test_user_dev@example.com",
                    "bitbucket_key": "new_secret_value",
                    "integration_provider": "bitbucket"
                }
            }
        """
        integration_update = IntegrationUpdate.model_validate_json(integration_update_json_str)
        initial_secret_value = integration_update.configuration.bitbucket_key

        existing_integration = Integration(
            id=uuid4(),
            name="bitbucket_dev_account",
            description="Initial_description",
            integration_type="cloud",
            integration_provider="bitbucket",
            configuration={
                "bitbucket_user": "test_user_dev@example.com",
                "bitbucket_key": f"EncryptedSecretStr:${ENCRYPTED_SECRET}",
                "integration_provider": "bitbucket",
            },
            labels=["bitbucket"],
            creator=User(),
            status=ModelStatus.ENABLED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=uuid4(),
            revision_number=1,
        )

        mock_integration_service.validate_configuration(
            integration_update=integration_update, existing_integration=existing_integration
        )

        updated_secret_value: EncryptedSecretStr = integration_update.configuration.bitbucket_key

        assert initial_secret_value.get_decrypted_value() == "new_secret_value"
        assert updated_secret_value.get_decrypted_value() == "new_secret_value"


class TestValidateConnection:
    @pytest.mark.asyncio
    async def test_aws_integration_validate_connection_success(self, mock_integration_service, monkeypatch):
        configuration = {
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "aws_account": "0123456789012",
            "aws_assumed_role_name": "test_role",
        }

        mock_provider_instance = AsyncMock()
        mock_provider_instance.authenticate.return_value = None
        mock_provider_instance.validate_connection.return_value = True

        monkeypatch.setattr(
            "core.adapters.provider_adapters.IntegrationProvider.adapters",
            {"aws": Mock(return_value=mock_provider_instance)},
        )

        result = await mock_integration_service.validate(integration_config=configuration, integration_provider="aws")

        expected_response = IntegrationValidationResponse(is_valid=True, message="Validation successful")

        assert result.is_valid == expected_response.is_valid
        assert result.message == expected_response.message

        mock_provider_instance.authenticate.assert_awaited_once()
        mock_provider_instance.is_valid.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_aws_integration_validate_connection_fail(self, mock_integration_service, monkeypatch):
        configuration = {
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "aws_account": "0123456789012",
            "aws_assumed_role_name": "test_role",
        }

        mock_provider_instance = AsyncMock()
        mock_provider_instance.authenticate.return_value = None
        mock_provider_instance.is_valid.side_effect = CloudWrongCredentials("Invalid AWS credentials")

        monkeypatch.setattr(
            "core.adapters.provider_adapters.IntegrationProvider.adapters",
            {"aws": Mock(return_value=mock_provider_instance)},
        )

        with pytest.raises(CloudWrongCredentials) as exc_info:
            await mock_integration_service.validate(integration_config=configuration, integration_provider="aws")

        assert str(exc_info.value) == "Invalid AWS credentials"

        mock_provider_instance.authenticate.assert_awaited_once()
        mock_provider_instance.is_valid.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_validate_connection_invalid_provider(self, mock_integration_service, monkeypatch):
        configuration = {
            "aws_access_key_id": "test_key",
            "aws_secret_access_key": "test_secret",
            "aws_account": "0123456789012",
            "aws_assumed_role_name": "test_role",
        }

        monkeypatch.setattr(
            "core.adapters.provider_adapters.IntegrationProvider.adapters",
            {},
        )
        monkeypatch.setattr(
            "core.adapters.provider_adapters.SecretProviderAdapter.adapters",
            {},
        )

        result = await mock_integration_service.validate(
            integration_config=configuration, integration_provider="unknown"
        )

        expected_response = IntegrationValidationResponse(
            is_valid=False, message="Unexpected error: Provider unknown is not supported"
        )

        assert result.is_valid == expected_response.is_valid
        assert result.message == expected_response.message
