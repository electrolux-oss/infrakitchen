from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.storages.crud import StorageCRUD
from application.storages.model import Storage
from application.storages.schema import AWSStorageConfig, StorageResponse
from application.storages.service import StorageService


@pytest.fixture
def mock_storage_crud():
    crud = Mock(spec=StorageCRUD)
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
def mock_storage_service(
    mock_storage_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_integration_service,
):
    return StorageService(
        crud=mock_storage_crud,
        integration_service=mock_integration_service,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def storage_response(mocked_user_response, mocked_integration_response):
    config = AWSStorageConfig(
        aws_bucket_name="test-bucket",
        aws_region="us-west-2",
    )
    return StorageResponse(
        id=uuid4(),
        name="TestStorage",
        labels=["label1", "label2"],
        creator=mocked_user_response,
        storage_type="tofu",
        integration=mocked_integration_response,
        storage_provider="aws",
        configuration=config,
    )


@pytest.fixture
def mocked_storage(mocked_user, mocked_integration):
    return Storage(
        id=uuid4(),
        name="TestStorage",
        labels=["label1", "label2"],
        description="Test storage description",
        storage_type="tofu",
        storage_provider="aws",
        status="ready",
        state="provision",
        configuration={
            "aws_bucket_name": "test-bucket",
            "aws_region": "us-west-2",
            "storage_provider": "aws",
        },
        creator=mocked_user,
        created_by=mocked_user.id,
        integration=mocked_integration,
        integration_id=mocked_integration.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
