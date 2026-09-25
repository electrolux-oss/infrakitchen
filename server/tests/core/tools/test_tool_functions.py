import hashlib
import io
import os
import zipfile
from unittest.mock import AsyncMock, Mock

import pytest

from core.tools import functions as tool_functions
from core.tools.functions import ensure_local_tool, resolve_tool, resolve_tool_to_run
from core.constants.model import ModelStatus
from core.errors import CannotProceed


def _zip(files: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        for name, data in files.items():
            archive.writestr(name, data)
    return buffer.getvalue()


@pytest.fixture
def local_tool(monkeypatch, tmp_path, mock_tool_crud, mocked_tool):
    monkeypatch.setenv("TOOL_CACHE_DIR", str(tmp_path))
    monkeypatch.setattr(tool_functions, "host_os", lambda: "linux")
    monkeypatch.setattr(tool_functions, "host_arch", lambda: "amd64")
    monkeypatch.setattr(tool_functions, "ToolCRUD", Mock(return_value=mock_tool_crud))

    content = _zip({"tofu": b"#!/bin/sh\necho tofu", "LICENSE.txt": b"license"})
    mocked_tool.sha256 = hashlib.sha256(content).hexdigest()
    mock_tool_crud.get_by_id.return_value = mocked_tool
    mock_tool_crud.get_content = AsyncMock(return_value=content)
    return mocked_tool


class TestEnsureLocalTool:
    async def test_unpacks_executable(self, local_tool, tmp_path):
        path = await ensure_local_tool(Mock(), local_tool.id)

        assert path == str(tmp_path / local_tool.sha256 / "tofu")
        assert os.access(path, os.X_OK)
        with open(path, "rb") as f:
            assert f.read() == b"#!/bin/sh\necho tofu"
        # only the executable is unpacked
        assert os.listdir(tmp_path / local_tool.sha256) == ["tofu"]

    async def test_uses_local_cache(self, local_tool, mock_tool_crud):
        first = await ensure_local_tool(Mock(), local_tool.id)
        mock_tool_crud.get_content.reset_mock()

        second = await ensure_local_tool(Mock(), local_tool.id)

        assert first == second
        mock_tool_crud.get_content.assert_not_awaited()

    async def test_not_downloaded(self, local_tool):
        local_tool.status = ModelStatus.QUEUED
        with pytest.raises(CannotProceed, match="not downloaded"):
            _ = await ensure_local_tool(Mock(), local_tool.id)

    async def test_disabled_tool_still_runs(self, local_tool, tmp_path):
        local_tool.status = ModelStatus.DISABLED
        path = await ensure_local_tool(Mock(), local_tool.id)
        assert path == str(tmp_path / local_tool.sha256 / "tofu")

    async def test_other_platform(self, local_tool):
        local_tool.arch = "arm64"
        with pytest.raises(CannotProceed, match="cannot run on this worker"):
            _ = await ensure_local_tool(Mock(), local_tool.id)

    async def test_checksum_mismatch(self, local_tool):
        local_tool.sha256 = "0" * 64
        with pytest.raises(CannotProceed, match="checksum"):
            _ = await ensure_local_tool(Mock(), local_tool.id)

    async def test_executable_missing_in_archive(self, local_tool, mock_tool_crud):
        content = _zip({"terraform": b"tool"})
        local_tool.sha256 = hashlib.sha256(content).hexdigest()
        mock_tool_crud.get_content.return_value = content
        with pytest.raises(CannotProceed, match="not found in the archive"):
            _ = await ensure_local_tool(Mock(), local_tool.id)


class TestResolveTool:
    async def test_selected_tool(self, local_tool, mock_tool_crud):
        assert await resolve_tool(Mock(), local_tool.id) is local_tool
        mock_tool_crud.get_default.assert_not_awaited()

    async def test_selected_tool_not_found(self, local_tool, mock_tool_crud):
        mock_tool_crud.get_by_id.return_value = None
        with pytest.raises(CannotProceed, match="not found"):
            _ = await resolve_tool(Mock(), local_tool.id)

    async def test_falls_back_to_default(self, local_tool, mock_tool_crud):
        mock_tool_crud.get_default.return_value = local_tool
        assert await resolve_tool(Mock(), None) is local_tool

    async def test_no_default(self, local_tool, mock_tool_crud):
        mock_tool_crud.get_default.return_value = None
        assert await resolve_tool(Mock(), None) is None


class TestResolveToolToRun:
    async def test_default_tool(self, local_tool, mock_tool_crud, tmp_path):
        mock_tool_crud.get_default.return_value = local_tool
        tool = await resolve_tool_to_run(Mock(), None)
        assert tool.path == str(tmp_path / local_tool.sha256 / "tofu")
        assert tool.label == "OpenTofu 1.13.0"

    async def test_runtime_tofu_without_default(self, local_tool, mock_tool_crud):
        mock_tool_crud.get_default.return_value = None
        tool = await resolve_tool_to_run(Mock(), None)
        assert tool.path is None
        assert tool.label == "tofu installed on the worker"
