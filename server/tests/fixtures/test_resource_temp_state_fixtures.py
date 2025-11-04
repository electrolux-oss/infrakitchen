import uuid
from datetime import datetime
from unittest.mock import Mock, AsyncMock

import pytest

from application.resource_temp_state.model import ResourceTempState
from application.resource_temp_state.crud import ResourceTempStateCrud
from application.resource_temp_state.handler import ResourceTempStateHandler
from application.resource_temp_state.schema import ResourceTempStateResponse
from application.resource_temp_state.service import ResourceTempStateService


@pytest.fixture
def mocked_resource_temp_state_response():
    return ResourceTempStateResponse(
        id=uuid.uuid4(),
        resource_id=uuid.uuid4(),
        value={"old_key": "new_value"},
        created_by=str(uuid.uuid4()),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def mocked_resource_temp_state_service(mocked_resource_temp_state_crud):
    return ResourceTempStateService(crud=mocked_resource_temp_state_crud)


@pytest.fixture
def mocked_resource_temp_state_crud():
    crud = Mock(spec=ResourceTempStateCrud)
    crud.create = AsyncMock()
    crud.get_by_id = AsyncMock()
    crud.get_by_resource_id = AsyncMock()
    crud.get_all = AsyncMock()
    crud.count = AsyncMock()
    crud.delete = AsyncMock()
    return crud


@pytest.fixture
def mocked_resource_temp_state():
    return ResourceTempState(
        id=uuid.uuid4(),
        resource_id=uuid.uuid4(),
        value={"key": "value"},
        created_by=str(uuid.uuid4()),
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


@pytest.fixture
def mocked_resource_temp_state_handler():
    handler = Mock(spec=ResourceTempStateHandler)
    handler.create = AsyncMock()
    handler.set_entity_temp_state = AsyncMock()
    handler.update_resource_temp_state = AsyncMock()
    handler.get_by_resource_id = AsyncMock()
    handler.delete_by_resource_id = AsyncMock()
    return handler
