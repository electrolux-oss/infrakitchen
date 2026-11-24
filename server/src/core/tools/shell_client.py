import asyncio
import logging
import tempfile
import os

from core.custom_entity_log_controller import EntityLogger
from core.errors import ShellExecutionError

log = logging.getLogger("sh_client")

_CHUNK_SIZE = 64 * 1024


async def _read_stream(stream: asyncio.StreamReader, cb):
    """Reads lines from an async stream and calls a callback for each line."""
    while True:
        line = await stream.readline()
        if line:
            cb(line.decode("utf-8").rstrip())  # Decode and rstrip before calling callback
        else:
            break


async def _read_chunks(stream: asyncio.StreamReader, cb):
    """
    Reads an async stream in chunks and calls a callback with each chunk (bytes).
    For machine-readable output such as `tofu show -json`, which prints one line longer
    than the line limit of `readline()` (64 KiB).
    """
    while chunk := await stream.read(_CHUNK_SIZE):
        cb(chunk)


async def _terminate(process: asyncio.subprocess.Process, grace_seconds: float = 10) -> None:
    """SIGTERM first so tofu can release its state lock, then SIGKILL if it doesn't exit."""
    process.terminate()
    try:
        _ = await asyncio.wait_for(asyncio.shield(process.wait()), timeout=grace_seconds)
    except TimeoutError:
        process.kill()
        _ = await process.wait()


async def _stream_subprocess(
    cmd: list[str],
    stdout_cb,
    stderr_cb,
    cwd: str | None = None,
    env: dict[str, str] | None = None,
    raw_stdout: bool = False,
) -> tuple[int, int | None]:
    """
    Executes a subprocess, streaming its stdout and stderr to callbacks.

    Args:
        cmd (list[str]): The command and its arguments as a list.
        stdout_cb (callable): Callback function for stdout lines. Takes one string argument (the line),
            or one bytes argument (a chunk) with `raw_stdout`.
        stderr_cb (callable): Callback function for stderr lines. Takes one string argument (the line).
        cwd (str, optional): The current working directory for the subprocess.
        env (dict, optional): The environment variables for the subprocess.
        raw_stdout (bool): Pass stdout in chunks instead of lines, for output with very long lines.

    Returns:
        tuple[int, int]: A tuple containing the process PID and its return code.
                         If the process can't be started or its output can't be read, the return code is -1.
    """
    process = None
    readers: list[asyncio.Task[None]] = []
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd, env=env
        )
        assert process.stdout is not None, "Subprocess stdout is None"
        assert process.stderr is not None, "Subprocess stderr is None"

        read_stdout = _read_chunks if raw_stdout else _read_stream
        stdout_task = asyncio.create_task(read_stdout(process.stdout, stdout_cb))
        stderr_task = asyncio.create_task(_read_stream(process.stderr, stderr_cb))
        readers = [stdout_task, stderr_task]

        # Wait for both stream readers to complete and the process to finish
        # We wait for ALL tasks to complete, including the process itself
        _ = await asyncio.gather(stdout_task, stderr_task, process.wait())

        rc = process.returncode
        return process.pid, rc
    except asyncio.CancelledError:
        # The task was aborted (e.g. the worker lost its lease): don't leave tofu/git running
        if process and process.returncode is None:
            await _terminate(process)
        raise
    except OSError as e:
        log.error(f"Failed to execute command '{' '.join(cmd)}': {e}")
        # In this case, the process might not have even started, so pid is unknown
        return 0, -1  # Indicate an error that prevented subprocess creation
    except Exception as e:
        log.error(f"An unexpected error occurred during subprocess streaming: {e}")
        if process is None:
            return 0, -1
        # The output is incomplete, so the command failed. Nobody reads its pipes anymore:
        # stop the process, or it may block on a full pipe forever
        if process.returncode is None:
            await _terminate(process)
        return process.pid, -1
    finally:
        for reader in readers:
            _ = reader.cancel()


class ShellScriptClient:
    """
    Executes shell commands asynchronously and logs the output using EntityLogger.
    """

    def __init__(
        self,
        command: str,
        command_args: str | list[str],
        logger: EntityLogger | None = None,
        workspace_path: str | None = None,
        environment_variables: dict[str, str] | None = None,
        log_stdout: bool = True,
    ):
        self.logger: EntityLogger | logging.Logger = logger if logger else log
        # off for machine-readable output (e.g. `tofu show -json`): large, and it holds attribute values.
        # Unlogged stdout is captured in chunks, as it may be a single line of any length
        self.log_stdout: bool = log_stdout
        self.environment_variables: dict[str, str] = environment_variables or {}
        self.command: str = command

        self.command_args: str | list[str] = command_args

        if isinstance(command_args, str):
            command_args = command_args.strip().split()

        for key, value in self.environment_variables.items():
            if value is None:
                self.environment_variables[key] = ""

        self.workspace_path: str = workspace_path or tempfile.mkdtemp()
        self._command_parts: list[str] = [command] + command_args if command_args else [command]

    def sanitize_command(self, data: str) -> str:
        for key, value in self.environment_variables.items():
            if value in data and value != "":
                data = data.replace(value, f"***Masked value <{key}>***")
        return data

    async def run_shell_command(self) -> str:
        self.logger.info(
            self.sanitize_command(f"Executing: {' '.join(self._command_parts)} (cwd={self.workspace_path})")
        )

        captured_stdout_lines: list[str] = []
        captured_stdout_chunks: list[bytes] = []
        captured_stderr_lines: list[str] = []
        environment_variables: dict[str, str] = {**self._default_env(), **self.environment_variables}

        # Track pending save tasks to avoid duplication
        pending_save_task: asyncio.Task[None] | None = None

        async def trigger_save_if_needed():
            nonlocal pending_save_task
            if isinstance(self.logger, EntityLogger):
                # Only create new save task if one isn't already running
                if pending_save_task is None or pending_save_task.done():
                    pending_save_task = asyncio.create_task(self.logger.save_if_more_than(5))

        def stdout_callback(line: str):
            captured_stdout_lines.append(line)
            self.logger.info(line)
            _ = asyncio.create_task(trigger_save_if_needed())

        def stdout_chunk_callback(chunk: bytes):
            captured_stdout_chunks.append(chunk)

        def stderr_callback(line: str):
            # Capture stderr lines, but defer logging until we know the exit code
            # Many tools (like git) write informational messages to stderr even on success
            captured_stderr_lines.append(line)
            _ = asyncio.create_task(trigger_save_if_needed())

        _, return_code = await _stream_subprocess(
            cmd=self._command_parts,
            stdout_cb=stdout_callback if self.log_stdout else stdout_chunk_callback,
            stderr_cb=stderr_callback,
            cwd=self.workspace_path,
            env=environment_variables,
            raw_stdout=not self.log_stdout,
        )

        # Log stderr lines with appropriate level based on exit code
        # If command succeeded (return_code == 0), log as INFO since many tools use stderr for status messages
        # If command failed, log as ERROR since these are actual error messages
        for line in captured_stderr_lines:
            if return_code != 0:
                self.logger.error(line)
            else:
                self.logger.info(line)

        # After the subprocess finishes, ensure all logs are saved
        if isinstance(self.logger, EntityLogger):
            await self.logger.save_log()

        if return_code != 0:
            self.logger.error(f"Command '{self.command}' failed with exit code {return_code}")
            raise ShellExecutionError(f"Command '{self.command}' failed with exit code {return_code}.")

        if not self.log_stdout:
            # decoded once joined: a chunk may end in the middle of a multi-byte character
            return b"".join(captured_stdout_chunks).decode("utf-8").strip()
        return "\n".join(captured_stdout_lines).strip()

    def _default_env(self) -> dict[str, str]:
        """Return forced environment variables such as PATH & proxy variables."""
        return {key: os.getenv(key, "") for key in {"PATH", "HTTPS_PROXY", "HTTP_PROXY", "NO_PROXY"}}
