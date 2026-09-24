import pytest
from pydantic import ValidationError

from core.tools.schema import ToolDownloadRequest


class TestToolDownloadRequest:
    def test_strips_v_prefix(self):
        request = ToolDownloadRequest(name="opentofu", version="v1.8.0")
        assert request.version == "1.8.0"
        assert request.os == "linux"
        assert request.arch is None

    @pytest.mark.parametrize("version", ["latest", "1.8", "1.8.0/../../etc", ""])
    def test_invalid_version(self, version):
        with pytest.raises(ValidationError):
            _ = ToolDownloadRequest(name="opentofu", version=version)

    def test_unsupported_tool(self):
        with pytest.raises(ValidationError):
            _ = ToolDownloadRequest(name="pulumi", version="1.0.0")  # pyright: ignore[reportArgumentType]
