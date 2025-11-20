import uuid
import pytest

from unittest.mock import AsyncMock, Mock
from core.custom_entity_log_controller import EntityLogger
from core.logs.crud import LogCRUD
from core.logs.service import LogService


@pytest.fixture
def mock_entity_logger():
    mock_logger = EntityLogger(
        entity_name="test_entity",
        entity_id=str(uuid.uuid4()),
        revision_number=1,
        should_be_expired=False,
        trace_id=None,
    )

    # Mock async methods
    mock_logger.save_log = AsyncMock()
    mock_logger.send_messages = AsyncMock()

    return mock_logger


@pytest.fixture
def mock_log_crud():
    crud = Mock(spec=LogCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.get_logs_execution_time = AsyncMock()
    crud.delete_by_entity_id = AsyncMock()
    return crud


@pytest.fixture
def mock_log_service(mock_log_crud):
    return LogService(
        crud=mock_log_crud,
    )
