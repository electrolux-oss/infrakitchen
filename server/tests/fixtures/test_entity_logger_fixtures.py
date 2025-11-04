import uuid
import pytest

from unittest.mock import AsyncMock
from core.custom_entity_log_controller import EntityLogger


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
