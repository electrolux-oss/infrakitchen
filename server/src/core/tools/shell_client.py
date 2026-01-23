import asyncio
import logging
import tempfile
import os

from core.custom_entity_log_controller import EntityLogger
from core.errors import ShellExecutionError

log = logging.getLogger("sh_client")


async def _read_stream(stream: asyncio.StreamReader, cb):
    """Reads lines from an async stream and calls a callback for each line."""
    while True:
        line = await stream.readline()
        if line:
            cb(line.decode("utf-8").rstrip())  # Decode and rstrip before calling callback
        else:
            break


async def _stream_subprocess(
    cmd: list[str], stdout_cb, stderr_cb, cwd: str | None = None, env: dict[str, str] | None = None
) -> tuple[int, int | None]:
    """
    Executes a subprocess, streaming its stdout and stderr to callbacks.

    Args:
        cmd (list[str]): The command and its arguments as a list.
        stdout_cb (callable): Callback function for stdout lines. Takes one string argument (the line).
        stderr_cb (callable): Callback function for stderr lines. Takes one string argument (the line).
        cwd (str, optional): The current working directory for the subprocess.
        env (dict, optional): The environment variables for the subprocess.

    Returns:
        tuple[int, int]: A tuple containing the process PID and its return code.
                         If an OSError occurs, it returns (None, -1) and logs the error.
    """
    process = None
    try:
        process = await asyncio.create_subprocess_exec(
            *cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, cwd=cwd, env=env
        )
        assert process.stdout is not None, "Subprocess stdout is None"
        assert process.stderr is not None, "Subprocess stderr is None"

        # Create tasks for reading stdout and stderr
        stdout_task = asyncio.create_task(_read_stream(process.stdout, stdout_cb))
        stderr_task = asyncio.create_task(_read_stream(process.stderr, stderr_cb))

        # Wait for both stream readers to complete and the process to finish
        # We wait for ALL tasks to complete, including the process itself
        _ = await asyncio.gather(stdout_task, stderr_task, process.wait())

        rc = process.returncode
        return process.pid, rc
    except OSError as e:
        log.error(f"Failed to execute command '{' '.join(cmd)}': {e}")
        # In this case, the process might not have even started, so pid is unknown
        return 0, -1  # Indicate an error that prevented subprocess creation
    except Exception as e:
        log.error(f"An unexpected error occurred during subprocess streaming: {e}")
        if process:
            # If process started but something else failed, try to get its return code
            rc = process.returncode if process.returncode is not None else -1
            return process.pid, rc
        return 0, -1


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
    ):
        self.logger: EntityLogger | logging.Logger = logger if logger else log
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
        # Ensure PATH with binaries is included in the environment variables
        env_path = os.getenv("PATH", "")
        environment_variables: dict[str, str] = {**{"PATH": env_path}, **self.environment_variables}

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

        def stderr_callback(line: str):
            # Log as error, and trigger save_if_more_than on the EntityLogger
            self.logger.error(line)
            _ = asyncio.create_task(trigger_save_if_needed())

        _, return_code = await _stream_subprocess(
            cmd=self._command_parts,
            stdout_cb=stdout_callback,
            stderr_cb=stderr_callback,
            cwd=self.workspace_path,
            env=environment_variables,
        )

        # After the subprocess finishes, ensure all logs are saved
        if isinstance(self.logger, EntityLogger):
            await self.logger.save_log()

        if return_code != 0:
            self.logger.error(f"Command '{self.command}' failed with exit code {return_code}")
            raise ShellExecutionError(f"Command '{self.command}' failed with exit code {return_code}.")

        return "\n".join(captured_stdout_lines).strip()
