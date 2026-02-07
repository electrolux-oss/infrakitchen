from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.batch_operations.crud import BatchOperationCRUD
from application.batch_operations.model import BatchOperation
from application.batch_operations.schema import (
    BatchOperationResponse,
    BatchOperationResponseWithErrors,
)
from application.batch_operations.service import BatchOperationService


@pytest.fixture
def mock_batch_operation_crud():
    crud = Mock(spec=BatchOperationCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    return crud


@pytest.fixture
def mock_batch_operation_service(
    mock_batch_operation_crud,
    mock_executor_service,
    mock_resource_service,
    mock_task_entity_service,
    mock_event_sender,
    mock_audit_log_handler,
):
    return BatchOperationService(
        crud=mock_batch_operation_crud,
        executor_service=mock_executor_service,
        resource_service=mock_resource_service,
        task_service=mock_task_entity_service,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
    )


@pytest.fixture
def batch_operation_response(mocked_batch_operation):
    return BatchOperationResponse.model_validate(mocked_batch_operation)


@pytest.fixture
def batch_operation_response_with_errors(mocked_batch_operation):
    errored_id = uuid4()
    batch_operation_response_with_errors = BatchOperationResponseWithErrors.model_validate(mocked_batch_operation)
    batch_operation_response_with_errors.entity_ids.append(errored_id)
    batch_operation_response_with_errors.error_entity_ids = {
        errored_id: "Dry run is only allowed for resources in READY, ERROR, APPROVAL_PENDING, or DONE",
    }
    return batch_operation_response_with_errors


@pytest.fixture
def mocked_batch_operation(mocked_user):
    return BatchOperation(
        id=uuid4(),
        name="Test Batch Operation",
        description="Batch operation for testing",
        entity_type="resource",
        entity_ids=[uuid4(), uuid4()],
        creator=mocked_user,
        created_by=mocked_user.id,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
