from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.secrets.crud import SecretCRUD
from application.secrets.model import Secret
from application.secrets.schema import AWSSecretConfig, SecretResponse
from application.secrets.service import SecretService


@pytest.fixture
def mock_secret_crud():
    crud = Mock(spec=SecretCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.patch = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_dependencies = AsyncMock()
    return crud


@pytest.fixture
def mock_secret_service(
    mock_secret_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_integration_service,
):
    return SecretService(
        crud=mock_secret_crud,
        integration_service=mock_integration_service,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def mocked_secret_response(mocked_user_response, mocked_integration_response):
    config = AWSSecretConfig(
        name="test-secret",
        aws_region="us-west-2",
    )
    return SecretResponse(
        id=uuid4(),
        name="TestSecret",
        labels=["label1", "label2"],
        creator=mocked_user_response,
        secret_type="tofu",
        integration=mocked_integration_response,
        secret_provider="aws",
        configuration=config,
    )


@pytest.fixture
def mocked_secret(mocked_user, mocked_integration):
    return Secret(
        id=uuid4(),
        name="TestSecret",
        labels=["label1", "label2"],
        description="Test secret description",
        secret_type="tofu",
        secret_provider="aws",
        status="enabled",
        configuration={
            "name": "test-bucket",
            "aws_region": "us-west-2",
            "secret_provider": "aws",
        },
        creator=mocked_user,
        created_by=mocked_user.id,
        integration=mocked_integration,
        integration_id=mocked_integration.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
