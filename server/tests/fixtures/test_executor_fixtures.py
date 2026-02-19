from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from application.executors.crud import ExecutorCRUD
from application.executors.model import Executor, ExecutorDTO
from application.executors.schema import ExecutorResponse
from application.executors.service import ExecutorService


@pytest.fixture
def mock_executor_crud():
    crud = Mock(spec=ExecutorCRUD)
    crud.session = Mock()
    crud.session.execute = AsyncMock()
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.get_executor_policies_by_role = AsyncMock()
    crud.get_user_executor_policies = AsyncMock()
    return crud


@pytest.fixture
def mock_executor_service(
    mock_executor_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_source_code_service,
    mock_storage_service,
    mock_integration_service,
    mock_permission_service,
    mock_log_service,
    mock_task_entity_service,
):
    return ExecutorService(
        crud=mock_executor_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        service_source_code=mock_source_code_service,
        storage_service=mock_storage_service,
        integration_service=mock_integration_service,
        permission_service=mock_permission_service,
        log_service=mock_log_service,
        task_service=mock_task_entity_service,
    )


@pytest.fixture
def executor_response(
    mocked_user_response,
    mocked_source_code_response,
    storage_response,
    mocked_integration_response,
):
    return ExecutorResponse(
        id=uuid4(),
        name="TestExecutor",
        description="A test executor",
        runtime="opentofu",
        command_args="-var-file=environments/dev/eu-west-1.tfvars",
        labels=["label1", "label2"],
        source_code=mocked_source_code_response,
        source_code_version="v1.0.0",
        source_code_branch="main",
        source_code_folder="executors/",
        storage=storage_response,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration_response],
        secret_ids=[],
        creator=mocked_user_response,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def mocked_executor(
    mocked_user,
    mocked_source_code,
    storage_response,
    mocked_integration,
):
    return Executor(
        id=uuid4(),
        name="TestExecutor",
        description="A test executor",
        runtime="opentofu",
        command_args="-var-file=environments/dev/eu-west-1.tfvars",
        labels=["label1", "label2"],
        source_code_id=mocked_source_code.id,
        source_code=mocked_source_code,
        source_code_version="v1.0.0",
        source_code_branch="main",
        source_code_folder="executors/",
        storage=storage_response,
        storage_path="path/to/storage",
        integration_ids=[mocked_integration],
        secret_ids=[],
        creator=mocked_user,
        created_by=mocked_user.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def many_executor_response(
    mocked_user_response,
    mocked_source_code_response,
    storage_response,
    mocked_integration_response,
):
    exec_id1 = uuid4()
    exec_id2 = uuid4()
    exec_id3 = uuid4()
    exec_id4 = uuid4()

    exec1 = ExecutorDTO(
        id=exec_id1,
        name="TestExecutor1",
        description="Test executor 1",
        runtime="opentofu",
        command_args="-var-file=environments/dev/eu-west-1.tfvars",
        labels=["label1", "label2"],
        source_code_id=mocked_source_code_response.id,
        source_code_version="v1.0.0",
        source_code_branch="main",
        source_code_folder="executors/exec1/",
        storage_id=storage_response.id,
        storage_path="path/to/storage/exec1",
        integration_ids=[mocked_integration_response.id],
        secret_ids=[],
        created_by=mocked_user_response.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    exec2 = ExecutorDTO(
        id=exec_id2,
        name="TestExecutor2",
        description="Test executor 2",
        runtime="opentofu",
        command_args="-var-file=environments/dev/eu-west-1.tfvars",
        labels=["label3", "label4"],
        source_code_id=mocked_source_code_response.id,
        source_code_version="v1.1.0",
        source_code_branch="develop",
        source_code_folder="executors/exec2/",
        storage_id=storage_response.id,
        storage_path="path/to/storage/exec2",
        integration_ids=[mocked_integration_response.id],
        secret_ids=[],
        created_by=mocked_user_response.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    exec3 = ExecutorDTO(
        id=exec_id3,
        name="TestExecutor3",
        description="Test executor 3",
        runtime="opentofu",
        command_args="-var-file=environments/dev/eu-west-1.tfvars",
        labels=["label5"],
        source_code_id=mocked_source_code_response.id,
        source_code_version="v2.0.0",
        source_code_branch="main",
        source_code_folder="executors/exec3/",
        storage_id=storage_response.id,
        storage_path="path/to/storage/exec3",
        integration_ids=[mocked_integration_response.id],
        secret_ids=[],
        created_by=mocked_user_response.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    exec4 = ExecutorDTO(
        id=exec_id4,
        name="TestExecutor4",
        description="Test executor 4",
        runtime="opentofu",
        command_args="-var-file=environments/dev/eu-west-1.tfvars",
        labels=["label6", "label7", "label8"],
        source_code_id=mocked_source_code_response.id,
        source_code_version="v2.1.0",
        source_code_branch="release",
        source_code_folder="executors/exec4/",
        storage_id=storage_response.id,
        storage_path="path/to/storage/exec4",
        integration_ids=[mocked_integration_response.id],
        secret_ids=[],
        created_by=mocked_user_response.id,
        revision_number=1,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )

    return [
        exec1,
        exec2,
        exec3,
        exec4,
    ]
