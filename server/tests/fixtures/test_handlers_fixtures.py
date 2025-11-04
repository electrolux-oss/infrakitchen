from unittest.mock import AsyncMock
import pytest


@pytest.fixture
def mock_revision_handler():
    return AsyncMock()


@pytest.fixture
def mock_event_sender():
    return AsyncMock()


@pytest.fixture
def mock_audit_log_handler():
    return AsyncMock()


@pytest.fixture
def mock_resource_temp_state_handler():
    return AsyncMock()


@pytest.fixture
def mock_task_handler():
    return AsyncMock()
