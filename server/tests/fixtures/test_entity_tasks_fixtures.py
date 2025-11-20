from unittest.mock import AsyncMock, Mock
import pytest

from core.tasks.crud import TaskEntityCRUD
from core.tasks.service import TaskEntityService


@pytest.fixture
def mock_task_entity_crud():
    crud = Mock(spec=TaskEntityCRUD)
    crud.get_by_id = AsyncMock()
    crud.get_one = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.create = AsyncMock()
    crud.delete_by_entity_id = AsyncMock()
    return crud


@pytest.fixture
def mock_task_entity_service(
    mock_task_entity_crud,
):
    return TaskEntityService(
        crud=mock_task_entity_crud,
    )
