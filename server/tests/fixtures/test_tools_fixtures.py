import pytest
from unittest.mock import AsyncMock


@pytest.fixture
def mock_stream_subprocess(monkeypatch) -> AsyncMock:
    """
    Mocks the internal _stream_subprocess function to control subprocess output and exit code.
    The mock is placed on the module where the ShellScriptClient looks it up.
    """
    mock = AsyncMock()

    monkeypatch.setattr("core.tools.shell_client._stream_subprocess", mock)

    mock.return_value = (100, 0)  # Default success: (pid, return_code)

    return mock
