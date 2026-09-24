from datetime import datetime
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from core.tools.crud import ToolCRUD
from core.tools.model import Tool
from core.tools.service import ToolService
from core.constants.model import ModelStatus


@pytest.fixture
def mock_tool_crud():
    crud = Mock(spec=ToolCRUD)
    crud.session = Mock()
    crud.get_by_id = AsyncMock()
    crud.get_one = AsyncMock(return_value=None)
    crud.get_default = AsyncMock(return_value=None)
    crud.set_default = AsyncMock()
    crud.get_all = AsyncMock()
    crud.get_content = AsyncMock()
    crud.create = AsyncMock()
    crud.update = AsyncMock()
    crud.delete = AsyncMock()
    crud.refresh = AsyncMock()
    crud.get_dependencies = AsyncMock(return_value=[])
    return crud


@pytest.fixture
def mock_tool_service():
    service = Mock(spec=ToolService)
    service.validate_ready = AsyncMock()
    return service


@pytest.fixture
def tool_service(mock_tool_crud, mock_event_sender, mock_audit_log_handler):
    return ToolService(crud=mock_tool_crud, event_sender=mock_event_sender, audit_log_handler=mock_audit_log_handler)


@pytest.fixture
def mocked_tool():
    return Tool(
        id=uuid4(),
        name="opentofu",
        version="1.13.0",
        os="linux",
        arch="amd64",
        executable="tofu",
        source_url="https://github.com/opentofu/opentofu/releases/download/v1.13.0/tofu_1.13.0_linux_amd64.zip",
        sha256="",
        size=0,
        status=ModelStatus.DONE,
        error_message="",
        is_default=False,
        created_by=None,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )
