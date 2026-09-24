import hashlib
from unittest.mock import AsyncMock, Mock

import httpx
import pytest

from core.tools import task as tool_task_module
from core.tools.task import ToolTask
from core.constants.model import ModelActions, ModelStatus
from core.errors import CannotProceed


@pytest.fixture
def tool_task(mocked_tool, mock_tool_crud, mock_entity_logger, mock_user_dto, mock_event_sender):
    mocked_tool.status = ModelStatus.QUEUED
    session = Mock()
    session.commit = AsyncMock()
    return ToolTask(
        session=session,
        crud_tool=mock_tool_crud,
        tool_instance=mocked_tool,
        logger=mock_entity_logger,
        user=mock_user_dto,
        event_sender=mock_event_sender,
        action=ModelActions.EXECUTE,
    )


class TestToolTask:
    async def test_download_success(self, tool_task, mocked_tool, monkeypatch):
        content = b"archive"
        sha = hashlib.sha256(content).hexdigest()
        monkeypatch.setattr(tool_task_module, "download_release", AsyncMock(return_value=(content, sha)))

        await tool_task.start_pipeline()

        assert mocked_tool.status == ModelStatus.DONE
        assert mocked_tool.content == content
        assert mocked_tool.sha256 == sha
        assert mocked_tool.size == len(content)

    async def test_download_failure(self, tool_task, mocked_tool, monkeypatch):
        monkeypatch.setattr(
            tool_task_module, "download_release", AsyncMock(side_effect=ValueError("Checksum mismatch"))
        )

        with pytest.raises(CannotProceed):
            await tool_task.start_pipeline()
        await tool_task.make_failed()

        assert mocked_tool.status == ModelStatus.ERROR
        assert mocked_tool.error_message == "Checksum mismatch"

    async def test_http_error(self, tool_task, mocked_tool, monkeypatch):
        monkeypatch.setattr(
            tool_task_module, "download_release", AsyncMock(side_effect=httpx.ConnectError("no network"))
        )

        with pytest.raises(CannotProceed):
            await tool_task.start_pipeline()
        assert mocked_tool.error_message == "no network"

    async def test_already_downloaded(self, tool_task, mocked_tool, monkeypatch):
        mocked_tool.status = ModelStatus.DONE
        download = AsyncMock()
        monkeypatch.setattr(tool_task_module, "download_release", download)

        await tool_task.start_pipeline()

        download.assert_not_awaited()
