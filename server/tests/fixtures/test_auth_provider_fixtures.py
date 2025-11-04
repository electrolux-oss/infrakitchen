from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from core.auth_providers.crud import AuthProviderCRUD
from core.auth_providers.model import AuthProvider
from core.auth_providers.schema import AuthProviderResponse, MicrosoftProviderConfig
from core.auth_providers.service import AuthProviderService
from core.models.encrypted_secret import EncryptedSecretStr

auth_provider_ID = "abc123"
CLIENT_SECRET = EncryptedSecretStr("secret123")


@pytest.fixture
def mock_auth_provider_crud():
    crud = Mock(spec=AuthProviderCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_tree = AsyncMock()
    return crud


@pytest.fixture
def mock_auth_provider_service(
    mock_auth_provider_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_casbin,
):
    service = Mock(spec=AuthProviderService)
    service.casbin_enforcer = mock_casbin
    service.crud = mock_auth_provider_crud
    service.revision_handler = mock_revision_handler
    service.event_sender = mock_event_sender
    service.audit_log_handler = mock_audit_log_handler
    service.get_by_id = AsyncMock()
    service.get_all = AsyncMock()
    service.count = AsyncMock()
    service.create = AsyncMock()
    service.update = AsyncMock()
    service.patch = AsyncMock()
    service.delete = AsyncMock()
    service.get_tree = AsyncMock()
    return service


@pytest.fixture
def auth_provider_response(mocked_user_response):
    return AuthProviderResponse(
        id=uuid4(),
        name="Test AuthProvider",
        auth_provider="microsoft",
        creator=mocked_user_response,
        configuration=MicrosoftProviderConfig(
            client_id="client123",
            client_secret=CLIENT_SECRET,
            tenant_id="tenant123",
            redirect_uri="http://localhost/callback",
        ),
    )


@pytest.fixture
def auth_provider(mocked_user_response):
    return AuthProvider(
        id=uuid4(),
        name="Test AuthProvider",
        auth_provider="microsoft",
        created_by=mocked_user_response.id,
        description="This is a test auth provider",
        configuration={
            "auth_provider": "microsoft",
            "client_id": "client123",
            "client_secret": CLIENT_SECRET.get_secret_value(),
            "tenant_id": "tenant123",
            "redirect_uri": "http://localhost/callback",
        },
        enabled=True,
        filter_by_domain=["example.com", "test.com"],
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
