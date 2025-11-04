from unittest.mock import Mock, AsyncMock

import pytest

from application.source_codes.task import SourceCodeTask


@pytest.fixture
def mock_task_controller(mocked_user, mock_entity_logger):
    mock_entity_logger.entity_id = "test_entity_123"
    mock_entity_logger.entity_name = "test_entity"
    mock_entity_logger.error = Mock()
    mock_entity_logger.warning = Mock()
    mock_entity_logger.save_log = AsyncMock()

    controller = Mock(spec=SourceCodeTask)
    controller.logger = mock_entity_logger
    controller.user = mocked_user
    controller.start_pipeline = AsyncMock()
    controller.make_failed = AsyncMock()
    controller.make_retry = AsyncMock()

    return controller


@pytest.fixture
def mock_task_controller_factory(mock_entity_logger):
    def _create_controller(
        entity_id="test_entity_123", entity_name="test_entity", user=None, controller_type=SourceCodeTask
    ):
        logger = Mock()
        logger.entity_id = entity_id
        logger.entity_name = entity_name
        logger.error = Mock()
        logger.warning = Mock()
        logger.save_log = AsyncMock()

        controller = Mock(spec=controller_type)
        controller.logger = logger
        controller.user = user
        controller.start_pipeline = AsyncMock()
        controller.make_failed = AsyncMock()
        controller.make_retry = AsyncMock()

        return controller

    return _create_controller
