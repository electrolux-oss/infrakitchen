from datetime import datetime
import pytest
from unittest.mock import AsyncMock, Mock

from uuid import uuid4

from application.source_codes.crud import SourceCodeCRUD
from application.source_codes.model import SourceCode
from application.source_codes.schema import SourceCodeResponse
from application.source_codes.service import SourceCodeService
from application.source_codes.task import SourceCodeTask
from core.constants import ModelStatus
from core.constants.model import ModelActions


@pytest.fixture
def mock_source_code_crud():
    crud = Mock(spec=SourceCodeCRUD)
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
def mock_source_code_service(
    mock_source_code_crud,
    mock_revision_handler,
    mock_event_sender,
    mock_audit_log_handler,
    mock_log_service,
    mock_task_entity_service,
):
    return SourceCodeService(
        crud=mock_source_code_crud,
        revision_handler=mock_revision_handler,
        event_sender=mock_event_sender,
        audit_log_handler=mock_audit_log_handler,
        log_service=mock_log_service,
        task_service=mock_task_entity_service,
    )


@pytest.fixture
def mocked_source_code_response(mocked_user_response, mocked_integration_response):
    return SourceCodeResponse(
        id=uuid4(),
        description="Test Source Code 1",
        labels=["label1", "label2"],
        creator=mocked_user_response,
        source_code_provider="github",
        source_code_language="opentofu",
        source_code_url="source_code_url",
        integration=mocked_integration_response,
    )


@pytest.fixture
def mocked_source_code(mocked_user):
    return SourceCode(
        id=uuid4(),
        integration_id=uuid4(),
        description="test_source_code",
        source_code_url="source_code_url",
        status=ModelStatus.READY,
        created_at=datetime.now(),
        updated_at=datetime.now(),
        revision_number=1,
        creator=mocked_user,
        created_by=mocked_user.id,
        labels=["label1", "label2"],
        source_code_provider="github",
        source_code_language="opentofu",
        git_tags=["v1.0", "v1.1"],
        git_branches=["main", "dev"],
        git_folders_map=[
            {
                "ref": "v1.0",
                "folders": [
                    "",
                    "redis/",
                ],
            },
            {
                "ref": "v1.1",
                "folders": [
                    "",
                    "redis/",
                    "postgres/",
                ],
            },
            {
                "ref": "main",
                "folders": [
                    "",
                    "redis/",
                    "postgres/",
                    "mysql/",
                ],
            },
            {
                "ref": "dev",
                "folders": [
                    "",
                    "redis/",
                ],
            },
        ],
    )


@pytest.fixture
def mocked_source_code_task(
    mock_source_code_crud,
    mock_user_dto,
    mocked_source_code,
    mock_task_handler,
    mock_event_sender,
    mock_entity_logger,
):
    return SourceCodeTask(
        session=AsyncMock(),
        source_code_instance=mocked_source_code,
        task_handler=mock_task_handler,
        crud_source_code=mock_source_code_crud,
        event_sender=mock_event_sender,
        logger=mock_entity_logger,
        user=mock_user_dto,
        action=ModelActions.SYNC,
    )
