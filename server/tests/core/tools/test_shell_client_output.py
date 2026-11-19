import asyncio
import sys
from unittest.mock import Mock

import pytest

import core.tools.shell_client as shell_client_mod
from core.errors import ShellExecutionError
from core.tools.shell_client import ShellScriptClient

# longer than the 64 KiB line limit of StreamReader.readline(), like the output of `tofu show -json`
LONG_LINE_LENGTH = 200_000


async def test_unlogged_output_with_a_very_long_line_is_captured_whole():
    logger = Mock()
    client = ShellScriptClient(
        sys.executable, ["-c", f"print('é' + 'x' * {LONG_LINE_LENGTH})"], logger=logger, log_stdout=False
    )

    output = await client.run_shell_command()

    assert output == "é" + "x" * LONG_LINE_LENGTH
    assert not any("xxxx" in str(call.args) for call in logger.info.call_args_list), "stdout must not be logged"


async def test_logged_output_is_still_logged_line_by_line():
    logger = Mock()
    client = ShellScriptClient(sys.executable, ["-c", "print('first'); print('second')"], logger=logger)

    output = await client.run_shell_command()

    assert output == "first\nsecond"
    logged = [call.args[0] for call in logger.info.call_args_list]
    assert "first" in logged and "second" in logged


async def test_unreadable_output_fails_the_command_and_stops_the_process(monkeypatch):
    started: list[asyncio.subprocess.Process] = []
    create = asyncio.create_subprocess_exec

    async def tracking_create(*args, **kwargs):
        process = await create(*args, **kwargs)
        started.append(process)
        return process

    monkeypatch.setattr(shell_client_mod.asyncio, "create_subprocess_exec", tracking_create)
    # a logged line too long for readline(), then the process keeps running
    script = f"import time; print('x' * {LONG_LINE_LENGTH}, flush=True); time.sleep(30)"
    client = ShellScriptClient(sys.executable, ["-c", script], logger=Mock())

    with pytest.raises(ShellExecutionError):
        await asyncio.wait_for(client.run_shell_command(), timeout=20)

    assert started[0].returncode is not None, "a process whose output can't be read must be stopped"
