from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.integrations.crud import IntegrationCRUD
from application.integrations.model import Integration
from application.integrations.schema import AWSIntegrationConfig, IntegrationResponse
from application.integrations.service import IntegrationService
from core.constants import ModelStatus
from core.models.encrypted_secret import EncryptedSecretStr
from core.users.schema import UserShort

INTEGRATION_ID = "abc123"


@pytest.fixture
def mock_integration_crud():
    crud = Mock(spec=IntegrationCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_dependencies = AsyncMock()
    crud.session = Mock()
    crud.session.flush = AsyncMock()
    return crud


@pytest.fixture
def mock_integration_service(
    mock_integration_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
):
    return IntegrationService(
        crud=mock_integration_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def mocked_integration_response(mocked_user_response):
    config = AWSIntegrationConfig(
        aws_account="123456789012",
        aws_access_key_id="test_access_key",
        aws_secret_access_key=EncryptedSecretStr("test_secret_key"),
        integration_provider="aws",
    )
    return IntegrationResponse(
        id=uuid4(),
        name="Test Integration",
        integration_type="cloud",
        integration_provider="aws",
        description="Test description",
        labels=["label1", "label2"],
        configuration=config,
        creator=mocked_user_response,
        status=ModelStatus.ENABLED,
    )


@pytest.fixture
def aws_integration_config():
    return AWSIntegrationConfig(
        aws_account="123456789012",
        aws_access_key_id="test_access_key",
        aws_secret_access_key=EncryptedSecretStr("test_secret_key"),
        integration_provider="aws",
    )


@pytest.fixture
def mocked_integration(mocked_user):
    config = AWSIntegrationConfig(
        aws_account="123456789012",
        aws_access_key_id="test_access_key",
        aws_secret_access_key=EncryptedSecretStr("test_secret_key"),
        integration_provider="aws",
    )
    return Integration(
        id=uuid4(),
        name="Test Integration",
        integration_type="cloud",
        integration_provider="aws",
        description="Test description",
        labels=["label1", "label2"],
        revision_number=1,
        status=ModelStatus.ENABLED,
        created_by=mocked_user.id,
        creator=mocked_user,
        configuration=config.model_dump(),
        updated_at=datetime.now(),
        created_at=datetime.now(),
    )


@pytest.fixture
def integration_responses_array(aws_integration_config):
    return [
        IntegrationResponse(
            id=uuid4(),
            creator=UserShort(id=uuid4(), provider="aws", identifier="identifier 1"),
            name="Integration 1",
            integration_type="cloud",
            integration_provider="aws",
            configuration=aws_integration_config,
        ),
        IntegrationResponse(
            id=uuid4(),
            creator=UserShort(id=uuid4(), provider="aws", identifier="identifier 2"),
            name="Integration 2",
            integration_type="cloud",
            integration_provider="aws",
            configuration=aws_integration_config,
        ),
    ]
