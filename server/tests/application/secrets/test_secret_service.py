from datetime import datetime
import pytest
from unittest.mock import Mock

from pydantic import PydanticUserError
from uuid import uuid4

from application.secrets.model import Secret
from application.secrets.schema import CustomSecretConfig, SecretResponse, SecretCreate, SecretUpdate
from core import UserDTO
from core.base_models import PatchBodyModel
from core.constants import ModelState, ModelStatus
from core.constants.model import ModelActions
from core.errors import DependencyError, EntityNotFound
from core.models.encrypted_secret import EncryptedSecretStr

SECRET_ID = "abc123"

INTEGRATION_ID = "b7e2c1a2-4f3a-4e2d-9c1b-8e2f7a6d5c3b"
ENCRYPTION_KEY = "TzIxN0hkbHN0SllDOEw4eWlxTERsb0xpZ0s3enRCM1hUdWxUamx1VHpVTT0=\n"
ENCRYPTED_SECRET = (
    "gAAAAABobl0aGntluKp6zDEk3keTzurHVa7JG0jQrH0tetUq11vn_axIez2H4Iig5Zjrv8Bke4Miy0CPGX4EKAqm3BdPTIgtUQ=="
)


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_secret_service, mock_secret_crud):
        mock_secret_crud.get_by_id.return_value = None

        result = await mock_secret_service.get_by_id("invalid_id")

        assert result is None
        mock_secret_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_secret_service, mock_secret_crud, monkeypatch, mocked_secret, mocked_secret_response
    ):
        mock_secret_crud.get_by_id.return_value = mocked_secret
        mocked_validate = Mock(return_value=mocked_secret_response)
        monkeypatch.setattr(SecretResponse, "model_validate", mocked_validate)

        result = await mock_secret_service.get_by_id(SECRET_ID)

        assert result.name == mocked_secret.name

        mock_secret_crud.get_by_id.assert_awaited_once_with(SECRET_ID)
        mocked_validate.assert_called_once_with(mocked_secret)

    @pytest.mark.asyncio
    async def test_get_by_id_error(self, mock_secret_service, mock_secret_crud, monkeypatch, mocked_secret):
        mock_secret_crud.get_by_id.return_value = mocked_secret

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SecretResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_secret_service.get_by_id(SECRET_ID)

        assert exc.value is error
        mock_secret_crud.get_by_id.assert_awaited_once_with(SECRET_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_secret_service, mock_secret_crud):
        mock_secret_crud.get_all.return_value = []

        result = await mock_secret_service.get_all(limit=10)

        assert result == []
        mock_secret_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(
        self,
        mock_secret_service,
        mock_secret_crud,
        monkeypatch,
        mocked_secret,
        mocked_user_response,
        mocked_integration_response,
    ):
        secret1 = mocked_secret
        secret2 = mocked_secret
        secret2.id = uuid4()
        secrets = [secret1, secret2]
        mock_secret_crud.get_all.return_value = secrets

        mocked_secret_response_1 = SecretResponse(
            id=secret1.id,
            name=secret1.name,
            secret_provider=secret1.secret_provider,
            secret_type=secret1.secret_type,
            creator=mocked_user_response,
            integration=mocked_integration_response,
            configuration=secret1.configuration,
        )
        mocked_secret_response_2 = SecretResponse(
            id=secret2.id,
            name=secret2.name,
            secret_provider=secret2.secret_provider,
            secret_type=secret2.secret_type,
            creator=mocked_user_response,
            integration=mocked_integration_response,
            configuration=secret2.configuration,
        )

        def mock_model_validate_validate(arg):
            return mocked_secret_response_1 if arg.id == secret1.id else mocked_secret_response_2

        monkeypatch.setattr(SecretResponse, "model_validate", mock_model_validate_validate)

        result = await mock_secret_service.get_all(limit=10, offset=0)

        assert result[0].name == secret1.name
        assert result[1].name == secret2.name
        mock_secret_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_secret_service, mock_secret_crud, monkeypatch, mocked_secret):
        mock_secret_crud.get_all.return_value = [mocked_secret]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SecretResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_secret_service.get_all(limit=10)

        assert exc.value is error
        mock_secret_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_secret_service, mock_secret_crud):
        mock_secret_crud.count.return_value = 1

        result = await mock_secret_service.count(filter={"key": "value"})

        assert result == 1

        mock_secret_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_secret_service, mock_secret_crud):
        error = RuntimeError("db failure")
        mock_secret_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_secret_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_secret_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_secret_service,
        mock_secret_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        mocked_secret,
        mock_integration_crud,
        mocked_integration,
        mocked_user,
    ):
        mocked_integration.status = ModelStatus.ENABLED
        mock_integration_crud.get_by_id.return_value = mocked_integration

        secret_body = {
            "name": "Test Secret",
            "description": "Test secret description",
            "labels": ["label1", "label2"],
            "secret_type": "tofu",
            "secret_provider": "aws",
            "integration_id": mocked_integration.id,
            "configuration": {
                "name": "test-bucket",
                "aws_region": "us-west-2",
                "secret_provider": "aws",
            },
        }
        secret_create = SecretCreate.model_validate(secret_body)
        expected_secret_body = secret_create.model_dump(exclude_unset=True)
        expected_secret_body["created_by"] = mocked_user.id

        mock_secret_crud.create.return_value = mocked_secret
        mock_secret_crud.get_by_id.return_value = mocked_secret

        result = await mock_secret_service.create(secret_create, mocked_user)

        mock_secret_crud.create.assert_awaited_once_with(expected_secret_body)

        mock_revision_handler.handle_revision.assert_awaited_once_with(mocked_secret)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_secret.id, mocked_user.id, ModelActions.CREATE
        )
        response = SecretResponse.model_validate(mocked_secret)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.CREATE)

        assert result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_create_invalid_integration_state(
        self, mock_secret_service, mocked_integration, mocked_user, mock_integration_crud
    ):
        mocked_integration.status = ModelStatus.DISABLED
        secret_body = {
            "name": "Test Secret",
            "secret_type": "tofu",
            "secret_provider": "aws",
            "integration_id": mocked_integration.id,
            "configuration": {
                "name": "test-bucket",
                "aws_region": "us-west-2",
                "secret_provider": "aws",
            },
        }
        secret_create = SecretCreate.model_validate(secret_body)
        mock_integration_crud.get_by_id.return_value = mocked_integration

        with pytest.raises(DependencyError, match="Integration must be enabled to create a secret"):
            await mock_secret_service.create(secret_create, mocked_user)

    @pytest.mark.asyncio
    async def test_create_error(
        self, mock_secret_service, mock_secret_crud, mocked_integration, mocked_user, mock_integration_crud
    ):
        secret_body = {
            "name": "Test Secret",
            "secret_type": "tofu",
            "secret_provider": "aws",
            "integration_id": mocked_integration.id,
            "configuration": {
                "name": "test-bucket",
                "aws_region": "us-west-2",
                "secret_provider": "aws",
            },
        }
        secret_create = SecretCreate.model_validate(secret_body)
        mock_integration_crud.get_by_id.return_value = mocked_integration

        error = RuntimeError("create fail")
        mock_secret_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_secret_service.create(secret_create, mocked_user)

        assert exc.value is error
        mock_secret_crud.create.assert_awaited_once()


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_secret_service,
        mock_secret_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_secret,
        mocked_secret_response,
        mock_user_dto,
    ):
        secret_update = SecretUpdate(description="Secret description")
        secret_id = uuid4()
        existing_secret = mocked_secret
        existing_secret.id = secret_id

        updated_secret = Secret(
            id=secret_id,
            name="Test Secret",
            status=ModelStatus.ENABLED,
        )
        mocked_secret_response_with_update = mocked_secret_response
        mocked_secret_response_with_update.id = secret_id
        mocked_secret_response_with_update.status = ModelStatus.ENABLED

        mock_secret_crud.get_by_id.return_value = existing_secret
        mock_secret_crud.update.return_value = updated_secret

        monkeypatch.setattr(SecretResponse, "model_validate", Mock(return_value=mocked_secret_response))

        result = await mock_secret_service.update(secret_id=secret_id, secret=secret_update, requester=mock_user_dto)

        mock_secret_crud.get_by_id.assert_awaited_once_with(secret_id)
        mock_secret_crud.update.assert_awaited_once_with(existing_secret, secret_update.model_dump(exclude_unset=True))

        mock_audit_log_handler.create_log.assert_awaited_once_with(
            updated_secret.id, mock_user_dto.id, ModelActions.UPDATE
        )
        mock_secret_crud.refresh.assert_awaited_once_with(existing_secret)
        mock_revision_handler.handle_revision.assert_awaited_once_with(existing_secret)
        response = SecretResponse.model_validate(updated_secret)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.UPDATE)

        assert result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_update_secret_does_not_exist(self, mock_secret_service, mock_secret_crud):
        secret_update = Mock(spec=SecretUpdate)
        requester = Mock(spec=UserDTO)

        mock_secret_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Secret not found"):
            await mock_secret_service.update(secret_id=SECRET_ID, secret=secret_update, requester=requester)

    @pytest.mark.asyncio
    async def test_update_secret_has_invalid_status(self, mock_secret_service, mock_secret_crud):
        secret_update = Mock(spec=SecretUpdate)
        requester = Mock(spec=UserDTO)
        requester.id = uuid4()

        existing_secret = Secret(id=uuid4(), name="Test Secret", status=None, state=None)
        mock_secret_crud.get_by_id.return_value = existing_secret

        with pytest.raises(ValueError):
            await mock_secret_service.update(secret_id=SECRET_ID, secret=secret_update, requester=requester)

    @pytest.mark.asyncio
    async def test_update_secret_has_status_disabled(
        self,
        mock_secret_service,
        mock_secret_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mocked_secret,
        mocked_secret_response,
        mock_user_dto,
    ):
        aws_secret_config = {"aws_account": "123456789012", "aws_access_key_id": "updated"}

        secret_update = Mock(spec=SecretUpdate)
        secret_update.name = "New Secret name"
        secret_update.description = "Updated description"
        secret_update.secret_type = "cloud"
        secret_update.secret_provider = "aws"
        secret_update.configuration = aws_secret_config

        mocked_secret.status = ModelStatus.DISABLED
        mocked_secret.name = "New Secret name"

        mocked_secret_response.status = ModelStatus.ENABLED
        mocked_secret_response.name = "New Secret name"

        update_secret_body = {
            "name": "New Secret name",
            "created_by": "user1",
            "description": "Test description",
            "secret_type": "cloud",
            "secret_provider": "aws",
            "configuration": aws_secret_config,
        }

        secret_update.model_dump = Mock(return_value=update_secret_body)
        mock_secret_crud.get_by_id.return_value = mocked_secret
        mock_secret_crud.update.return_value = mocked_secret

        monkeypatch.setattr(SecretResponse, "model_validate", Mock(return_value=mocked_secret_response))
        monkeypatch.setattr(mock_secret_service, "validate_configuration", Mock())

        secret_update_result = await mock_secret_service.update(
            secret_id=mocked_secret.id, secret=secret_update, requester=mock_user_dto
        )

        secret_update.model_dump.assert_called_once_with(by_alias=True, exclude={"_entity_name"}, exclude_unset=True)
        mock_secret_crud.update.assert_called_once_with(mocked_secret, update_secret_body)
        mock_secret_crud.refresh.assert_called_once_with(mocked_secret)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_secret.id, mock_user_dto.id, ModelActions.UPDATE
        )
        mock_revision_handler.handle_revision.assert_awaited_once_with(mocked_secret)
        response = SecretResponse.model_validate(mocked_secret)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.UPDATE)

        assert secret_update_result.status == ModelStatus.ENABLED

    @pytest.mark.asyncio
    async def test_update_error(self, mock_secret_service, mock_secret_crud, mocked_secret):
        secret_update = Mock(spec=SecretUpdate)
        requester = Mock(spec=UserDTO)
        mock_secret_crud.get_by_id.return_value = mocked_secret

        error = RuntimeError("update fail")
        mock_secret_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_secret_service.update(secret_id=SECRET_ID, secret=secret_update, requester=requester)

        assert exc.value is error


class TestPatch:
    @pytest.mark.asyncio
    async def test_patch_success_with_status_disable(
        self,
        mock_secret_service,
        mock_secret_crud,
        mocked_secret,
        mocked_secret_response,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        mock_user_dto,
    ):
        mocked_secret.status = ModelStatus.ENABLED
        mocked_secret_response.status = ModelStatus.DISABLED

        mock_secret_crud.get_by_id.return_value = mocked_secret
        mock_secret_crud.get_dependencies.return_value = []
        monkeypatch.setattr(SecretResponse, "model_validate", Mock(return_value=mocked_secret_response))

        result = await mock_secret_service.patch_action(
            secret_id=SECRET_ID, body=PatchBodyModel(action=ModelActions.DISABLE), requester=mock_user_dto
        )

        mock_secret_crud.get_by_id.assert_awaited_once_with(SECRET_ID)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            mocked_secret.id, mock_user_dto.id, ModelActions.DISABLE
        )
        response = SecretResponse.model_validate(mocked_secret)
        mock_event_sender.send_event.assert_awaited_once_with(response, ModelActions.DISABLE)
        assert result.status == ModelStatus.DISABLED

    @pytest.mark.asyncio
    async def test_patch_secret_not_found(self, mock_secret_service, mock_secret_crud, mock_user_dto):
        mock_secret_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Secret not found"):
            await mock_secret_service.patch_action(
                secret_id=SECRET_ID, body=PatchBodyModel(action=ModelActions.APPROVE), requester=mock_user_dto
            )


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(
        self,
        mock_secret_service,
        mock_secret_crud,
        mock_log_crud,
        mock_user_dto,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        existing_secret = Secret(
            id=uuid4(),
            name="Test Secret",
            status=ModelStatus.DONE,
            state=ModelState.DESTROYED,
        )
        mock_secret_crud.get_by_id.return_value = existing_secret

        await mock_secret_service.delete(secret_id=existing_secret.id, requester=mock_user_dto)

        mock_secret_crud.get_by_id.assert_awaited_once_with(existing_secret.id)
        mock_secret_crud.delete.assert_awaited_once_with(existing_secret)
        mock_audit_log_handler.create_log.assert_awaited_once_with(
            existing_secret.id, mock_user_dto.id, ModelActions.DELETE
        )
        mock_revision_handler.delete_revisions.assert_awaited_once_with(existing_secret.id)

    @pytest.mark.asyncio
    async def test_delete_secret_does_not_exist(
        self,
        mock_secret_service,
        mock_secret_crud,
        mock_log_crud,
        mock_revision_handler,
        mock_audit_log_handler,
        mock_task_entity_crud,
    ):
        requester = Mock(spec=UserDTO)

        mock_secret_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="Secret not found"):
            await mock_secret_service.delete(secret_id=SECRET_ID, requester=requester)

        mock_log_crud.delete_by_entity_id.assert_not_awaited()
        mock_revision_handler.delete_revisions.assert_not_awaited()
        mock_audit_log_handler.create_log.assert_not_awaited()
        mock_task_entity_crud.delete_by_entity_id.assert_not_awaited()


class TestGetSecretActions:
    @pytest.mark.asyncio
    async def test_get_actions_for_enabled_not_admin(
        self,
        mock_secret_service,
        mock_secret_crud,
        mocked_secret,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(
            ["write"],
            monkeypatch,
            "application.secrets.service.user_entity_permissions",
        )

        mocked_secret.status = ModelStatus.ENABLED
        mock_secret_crud.get_by_id.return_value = mocked_secret

        result = await mock_secret_service.get_actions(secret_id=mocked_secret.id, requester=mock_user_dto)

        assert result == []
        mock_secret_crud.get_by_id.assert_awaited_once_with(mocked_secret.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_enabled_admin(
        self,
        mock_secret_service,
        mock_secret_crud,
        mocked_secret,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["write", "admin"], monkeypatch, "application.secrets.service.user_entity_permissions")

        existing_secret = mocked_secret
        existing_secret.status = ModelStatus.ENABLED
        mock_secret_crud.get_by_id.return_value = existing_secret

        result = await mock_secret_service.get_actions(secret_id=mocked_secret.id, requester=mock_user_dto)

        assert result == [ModelActions.EDIT, ModelActions.DISABLE]
        mock_secret_crud.get_by_id.assert_awaited_once_with(mocked_secret.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_disabled_not_admin(
        self,
        mock_secret_service,
        mock_secret_crud,
        mocked_secret,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["write"], monkeypatch, "application.secrets.service.user_entity_permissions")

        mocked_secret.status = ModelStatus.DISABLED
        mock_secret_crud.get_by_id.return_value = mocked_secret

        result = await mock_secret_service.get_actions(secret_id=mocked_secret.id, requester=mock_user_dto)

        assert result == []
        mock_secret_crud.get_by_id.assert_awaited_once_with(mocked_secret.id)

    @pytest.mark.asyncio
    async def test_get_actions_for_disabled_admin(
        self,
        mock_secret_service,
        mock_secret_crud,
        mocked_secret,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["write", "admin"], monkeypatch, "application.secrets.service.user_entity_permissions")

        mocked_secret.status = ModelStatus.DISABLED
        mock_secret_crud.get_by_id.return_value = mocked_secret

        result = await mock_secret_service.get_actions(secret_id=mocked_secret.id, requester=mock_user_dto)

        assert result == [ModelActions.DELETE, ModelActions.ENABLE]
        mock_secret_crud.get_by_id.assert_awaited_once_with(mocked_secret.id)

    @pytest.mark.asyncio
    async def test_get_actions_user_has_read_permissions(
        self,
        mock_secret_service,
        monkeypatch,
        mock_user_dto,
        mock_user_permissions,
    ):
        mock_user_permissions(["read"], monkeypatch, "application.secrets.service.user_entity_permissions")

        result = await mock_secret_service.get_actions(secret_id=SECRET_ID, requester=mock_user_dto)

        assert result == []


class TestValidateConfiguration:
    def test_validate_configuration_with_default_masked_secret(self, mock_secret_service, monkeypatch, mock_user_dto):
        monkeypatch.setenv("ENCRYPTION_KEY", ENCRYPTION_KEY)

        secret_update_json_str = """
            {
                "name": "custom_secret",
                "description": "Changed description",
                "secret_provider": "custom",
                "labels": [
                    "custom"
                ],
                "configuration": {
                    "secret_provider": "custom",
                    "secrets": [{
                        "name": "api_key",
                        "value": "**********"
                    }]
                }
            }
        """
        secret_update = SecretUpdate.model_validate_json(secret_update_json_str)
        assert isinstance(secret_update.configuration, CustomSecretConfig)
        initial_secret_value = secret_update.configuration.secrets[0].value

        existing_secret = Secret(
            id=uuid4(),
            name="custom_secret",
            description="Initial_description",
            secret_type="tofu",
            secret_provider="custom",
            configuration={
                # "bitbucket_key": f"EncryptedSecretStr:${ENCRYPTED_SECRET}",
                "secret_provider": "custom",
                "secrets": [{"name": "api_key", "value": f"EncryptedSecretStr:${ENCRYPTED_SECRET}"}],
            },
            labels=["custom"],
            creator=mock_user_dto,
            status=ModelStatus.ENABLED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=uuid4(),
            revision_number=1,
        )

        mock_secret_service.validate_configuration(secret_update=secret_update, existing_secret=existing_secret)

        updated_secret_value: EncryptedSecretStr = secret_update.configuration.secrets[0].value

        assert initial_secret_value.get_decrypted_value() == "**********"
        assert updated_secret_value.get_decrypted_value() == "test_key_dev"

    def test_validate_configuration_with_updated_secret(self, mock_secret_service, monkeypatch, mock_user_dto):
        monkeypatch.setenv("ENCRYPTION_KEY", ENCRYPTION_KEY)

        secret_update_json_str = """
            {
                "name": "custom_secret",
                "description": "Changed description",
                "secret_provider": "custom",
                "labels": [
                    "custom"
                ],
                "configuration": {
                    "secret_provider": "custom",
                    "secrets": [{
                        "name": "api_key",
                        "value": "new_secret_value"
                    }]
                }
            }
        """
        secret_update = SecretUpdate.model_validate_json(secret_update_json_str)
        assert isinstance(secret_update.configuration, CustomSecretConfig)
        initial_secret_value = secret_update.configuration.secrets[0].value

        existing_secret = Secret(
            id=uuid4(),
            name="custom_secret",
            description="Initial_description",
            secret_type="tofu",
            secret_provider="custom",
            configuration={
                "secrets": [{"name": "api_key", "value": f"EncryptedSecretStr:${ENCRYPTED_SECRET}"}],
                "secret_provider": "custom",
            },
            labels=["custom"],
            creator=mock_user_dto,
            status=ModelStatus.ENABLED,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            created_by=uuid4(),
            revision_number=1,
        )

        mock_secret_service.validate_configuration(secret_update=secret_update, existing_secret=existing_secret)

        updated_secret_value: EncryptedSecretStr = secret_update.configuration.secrets[0].value

        assert initial_secret_value.get_decrypted_value() == "new_secret_value"
        assert updated_secret_value.get_decrypted_value() == "new_secret_value"
