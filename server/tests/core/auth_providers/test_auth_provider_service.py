from unittest.mock import Mock
from uuid import uuid4

import pytest
from pydantic import PydanticUserError

from core import UserDTO
from core.auth_providers.model import AuthProvider, AuthProviderDTO
from core.auth_providers.schema import (
    AuthProviderResponse,
    AuthProviderCreate,
    AuthProviderUpdate,
    GuestProviderConfig,
    MicrosoftProviderConfig,
)
from core.auth_providers.service import AuthProviderService
from core.errors import EntityNotFound
from core.models.encrypted_secret import EncryptedSecretStr

auth_provider_ID = "abc123"


@pytest.fixture
def mock_auth_provider_service(
    mock_auth_provider_crud,
    mock_event_sender,
    mock_audit_log_handler,
):
    return AuthProviderService(
        crud=mock_auth_provider_crud,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


class TestGetById:
    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, mock_auth_provider_service, mock_auth_provider_crud):
        mock_auth_provider_crud.get_by_id.return_value = None

        result = await mock_auth_provider_service.get_by_id("invalid_id")

        assert result is None
        mock_auth_provider_crud.get_by_id.assert_awaited_once_with("invalid_id")

    @pytest.mark.asyncio
    async def test_get_by_id_success(
        self, mock_auth_provider_service, mock_auth_provider_crud, monkeypatch, auth_provider, auth_provider_response
    ):
        mock_auth_provider_crud.get_by_id.return_value = auth_provider
        mocked_validate = Mock(return_value=auth_provider_response)
        monkeypatch.setattr(AuthProviderResponse, "model_validate", mocked_validate)

        result = await mock_auth_provider_service.get_by_id(auth_provider_ID)

        assert result.auth_provider == auth_provider.auth_provider

        mock_auth_provider_crud.get_by_id.assert_awaited_once_with(auth_provider_ID)
        mocked_validate.assert_called_once_with(auth_provider)

    @pytest.mark.asyncio
    async def test_get_by_id_error(
        self, mock_auth_provider_service, mock_auth_provider_crud, monkeypatch, auth_provider
    ):
        mock_auth_provider_crud.get_by_id.return_value = auth_provider

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(AuthProviderResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_auth_provider_service.get_by_id(auth_provider_ID)

        assert exc.value is error
        mock_auth_provider_crud.get_by_id.assert_awaited_once_with(auth_provider_ID)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_auth_provider_service, mock_auth_provider_crud):
        mock_auth_provider_crud.get_all.return_value = []

        result = await mock_auth_provider_service.get_all(limit=10)

        assert result == []
        mock_auth_provider_crud.get_all.assert_awaited_once_with(limit=10)

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_auth_provider_service, mock_auth_provider_crud, monkeypatch):
        auth_providers = [
            AuthProvider(id=uuid4(), name="Test AuthProvider1", auth_provider="auth_provider1"),
            AuthProvider(id=uuid4(), name="Test AuthProvider2", auth_provider="auth_provider2"),
        ]
        mock_auth_provider_crud.get_all.return_value = auth_providers

        auth_provider_response_1 = AuthProviderResponse(
            id=uuid4(), name="Test AuthProvider 1", auth_provider="guest", configuration=GuestProviderConfig()
        )
        auth_provider_response_2 = AuthProviderResponse(
            id=uuid4(),
            name="Test AuthProvider 2",
            auth_provider="microsoft",
            configuration=MicrosoftProviderConfig(
                tenant_id="tenant123",
                client_id="client123",
                client_secret=EncryptedSecretStr("secret123"),
                auth_provider="microsoft",
                redirect_uri="http://localhost/callback",
            ),
        )

        def mock_model_validate_validate(arg):
            return auth_provider_response_1 if arg.auth_provider == "auth_provider1" else auth_provider_response_2

        monkeypatch.setattr(AuthProviderResponse, "model_validate", mock_model_validate_validate)

        result = await mock_auth_provider_service.get_all(limit=10, offset=0)

        assert result == [auth_provider_response_1, auth_provider_response_2]
        mock_auth_provider_crud.get_all.assert_awaited_once_with(limit=10, offset=0)

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_auth_provider_service, mock_auth_provider_crud, monkeypatch, auth_provider):
        mock_auth_provider_crud.get_all.return_value = [auth_provider]

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(AuthProviderResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_auth_provider_service.get_all(limit=10)

        assert exc.value is error
        mock_auth_provider_crud.get_all.assert_awaited_once_with(limit=10)


class TestCount:
    @pytest.mark.asyncio
    async def test_count_success(self, mock_auth_provider_service, mock_auth_provider_crud):
        mock_auth_provider_crud.count.return_value = 1

        result = await mock_auth_provider_service.count(filter={"key": "value"})

        assert result == 1

        mock_auth_provider_crud.count.assert_awaited_once_with(filter={"key": "value"})

    @pytest.mark.asyncio
    async def test_count_error(self, mock_auth_provider_service, mock_auth_provider_crud):
        error = RuntimeError("db failure")
        mock_auth_provider_crud.count.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_auth_provider_service.count(filter={"key": "value"})

        assert exc.value is error
        mock_auth_provider_crud.count.assert_awaited_once_with(filter={"key": "value"})


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(
        self,
        mock_auth_provider_service,
        mock_auth_provider_crud,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        auth_provider,
        auth_provider_response,
        mocked_user_response,
    ):
        auth_provider_body = {
            "name": "Test AuthProvider",
            "auth_provider": "microsoft",
            "configuration": {
                "tenant_id": "tenant123",
                "client_id": "client123",
                "client_secret": "secret123",
                "auth_provider": "microsoft",
                "redirect_uri": "http://localhost/callback",
            },
        }
        auth_provider_create = AuthProviderCreate.model_validate(auth_provider_body)
        requester = mocked_user_response

        new_auth_provider = AuthProvider(
            name="Test AuthProvider", auth_provider="microsoft", configuration=auth_provider_body["configuration"]
        )
        mock_auth_provider_crud.create.return_value = new_auth_provider
        mock_auth_provider_crud.get_by_id.return_value = auth_provider

        monkeypatch.setattr(AuthProviderResponse, "model_validate", Mock(return_value=auth_provider_response))

        result = await mock_auth_provider_service.create(auth_provider_create, requester)
        args, kwargs = mock_auth_provider_crud.create.call_args
        auth_call_body = args[0]
        assert auth_call_body["name"] == "Test AuthProvider"
        assert auth_call_body["auth_provider"] == "microsoft"
        assert auth_call_body["created_by"] == mocked_user_response.id
        assert auth_call_body["configuration"]["tenant_id"] == "tenant123"
        assert auth_call_body["configuration"]["client_id"] == "client123"
        assert auth_call_body["configuration"]["client_secret"].startswith("EncryptedSecretStr:")

        mock_audit_log_handler.create_log.assert_awaited_once_with(new_auth_provider.id, requester.id, "create")
        response = AuthProviderResponse.model_validate(new_auth_provider)
        mock_event_sender.send_event.assert_awaited_once_with(response, "create")

        assert result.auth_provider == "microsoft"
        assert result.name == "Test AuthProvider"
        assert result.configuration.tenant_id == "tenant123"
        assert result.configuration.client_secret.get_decrypted_value() == "secret123"

    @pytest.mark.asyncio
    async def test_create_error(self, mock_auth_provider_service, mock_auth_provider_crud, mocked_user_response):
        auth_provider_body = {
            "name": "Test AuthProvider",
            "auth_provider": "microsoft",
            "configuration": {
                "tenant_id": "tenant123",
                "client_id": "client123",
                "client_secret": "secret123",
                "auth_provider": "microsoft",
                "redirect_uri": "http://localhost/callback",
            },
        }
        auth_provider_create = AuthProviderCreate.model_validate(auth_provider_body)

        requester = mocked_user_response

        error = RuntimeError("create fail")
        mock_auth_provider_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_auth_provider_service.create(auth_provider_create, requester)

        assert exc.value is error
        mock_auth_provider_crud.create.assert_awaited_once()


class TestUpdate:
    @pytest.mark.asyncio
    async def test_update_success(
        self,
        mock_auth_provider_service,
        mock_auth_provider_crud,
        mock_audit_log_handler,
        mock_event_sender,
        monkeypatch,
        auth_provider_response,
        auth_provider,
        mocked_user_response,
    ):
        auth_provider_update_body = {
            "name": "Test AuthProvider",
            "description": "AuthProvider description updated",
            "enabled": True,
            "configuration": {
                "tenant_id": "tenant123",
                "client_id": "client123",
                "client_secret": "******",
                "auth_provider": "microsoft",
                "redirect_uri": "http://localhost/callback",
            },
        }
        auth_provider_update = AuthProviderUpdate.model_validate(auth_provider_update_body)

        existing_auth_provider = auth_provider
        updated_auth_provider = auth_provider
        updated_auth_provider.description = "AuthProvider description updated"

        mock_auth_provider_crud.get_by_id.return_value = existing_auth_provider
        mock_auth_provider_crud.update.return_value = updated_auth_provider
        requester = mocked_user_response

        monkeypatch.setattr(AuthProviderResponse, "model_validate", Mock(return_value=auth_provider_response))

        result = await mock_auth_provider_service.update(
            auth_provider_id=auth_provider_ID, auth_provider=auth_provider_update, requester=requester
        )
        assert result.name == "Test AuthProvider"
        assert result.enabled is True

        args, kwargs = mock_auth_provider_crud.update.call_args
        auth_call_body = args[1]

        assert auth_call_body["name"] == "Test AuthProvider"
        assert auth_call_body["enabled"] is True
        assert auth_call_body["description"] == "AuthProvider description updated"
        assert auth_call_body["configuration"]["tenant_id"] == "tenant123"
        assert auth_call_body["configuration"]["client_id"] == "client123"
        # need to skip secret value in test if its not updated
        assert EncryptedSecretStr(auth_call_body["configuration"]["client_secret"]).get_decrypted_value() == "secret123"

        mock_auth_provider_crud.get_by_id.assert_awaited_once_with(auth_provider_ID)

        mock_audit_log_handler.create_log.assert_awaited_once_with(updated_auth_provider.id, requester.id, "update")
        response = AuthProviderResponse.model_validate(updated_auth_provider)
        mock_event_sender.send_event.assert_awaited_once_with(response, "update")

    @pytest.mark.asyncio
    async def test_update_auth_provider_does_not_exist(self, mock_auth_provider_service, mock_auth_provider_crud):
        auth_provider_update = Mock(spec=AuthProviderUpdate)
        requester = Mock(spec=UserDTO)

        mock_auth_provider_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="AuthProvider not found"):
            await mock_auth_provider_service.update(
                auth_provider_id=auth_provider_ID, auth_provider=auth_provider_update, requester=requester
            )

    @pytest.mark.asyncio
    async def test_update_disable_single_auth_provider(
        self, mock_auth_provider_service, mock_auth_provider_crud, auth_provider
    ):
        auth_provider_update = AuthProviderUpdate(enabled=False)
        requester = Mock(spec=UserDTO)

        mock_auth_provider_crud.get_by_id.return_value = auth_provider
        mock_auth_provider_crud.count.return_value = 1

        with pytest.raises(ValueError) as exc:
            await mock_auth_provider_service.update(
                auth_provider_id=auth_provider_ID, auth_provider=auth_provider_update, requester=requester
            )

        assert exc.value.args[0] == "Cannot disable single provider"
        mock_auth_provider_crud.update.assert_not_called()

    @pytest.mark.asyncio
    async def test_update_error(self, mock_auth_provider_service, mock_auth_provider_crud, auth_provider, monkeypatch):
        auth_provider_update = AuthProviderUpdate(enabled=True)
        requester = Mock(spec=UserDTO)
        existing_auth_provider = auth_provider
        mock_auth_provider_crud.get_by_id.return_value = existing_auth_provider

        def validate_configuration(provider_to_update: AuthProviderUpdate, provider_from_db: AuthProviderDTO) -> None:
            pass

        monkeypatch.setattr("core.auth_providers.service.validate_configuration", validate_configuration)

        error = RuntimeError("update fail")
        mock_auth_provider_crud.update.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_auth_provider_service.update(
                auth_provider_id=auth_provider_ID, auth_provider=auth_provider_update, requester=requester
            )

        assert exc.value is error


class TestDelete:
    @pytest.mark.asyncio
    async def test_delete_success(self, mock_auth_provider_service, mock_auth_provider_crud, auth_provider):
        existing_auth_provider = auth_provider
        existing_auth_provider.enabled = False
        mock_auth_provider_crud.get_by_id.return_value = existing_auth_provider
        requester = Mock(spec=UserDTO)

        await mock_auth_provider_service.delete(auth_provider_id=auth_provider_ID, requester=requester)

        mock_auth_provider_crud.get_by_id.assert_awaited_once_with(auth_provider_ID)
        mock_auth_provider_crud.delete.assert_awaited_once_with(existing_auth_provider)

    @pytest.mark.asyncio
    async def test_delete_auth_provider_does_not_exist(self, mock_auth_provider_service, mock_auth_provider_crud):
        requester = Mock(spec=UserDTO)

        mock_auth_provider_crud.get_by_id.return_value = None

        with pytest.raises(EntityNotFound, match="AuthProvider not found"):
            await mock_auth_provider_service.delete(auth_provider_id=auth_provider_ID, requester=requester)

    @pytest.mark.asyncio
    async def test_delete_auth_provider_is_enabled(
        self, mock_auth_provider_service, mock_auth_provider_crud, auth_provider
    ):
        existing_auth_provider = auth_provider
        mock_auth_provider_crud.get_by_id.return_value = existing_auth_provider
        requester = Mock(spec=UserDTO)

        with pytest.raises(ValueError) as exc:
            await mock_auth_provider_service.delete(auth_provider_id=auth_provider_ID, requester=requester)

        assert exc.value.args[0] == "Provider must be disabled before deletion"
        mock_auth_provider_crud.delete.assert_not_called()
