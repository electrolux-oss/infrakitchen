import asyncio
import hashlib
import io
import os
import platform
import shutil
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from core.config import Settings
from core.constants.model import ModelStatus
from core.errors import CannotProceed

from .crud import ToolCRUD
from .model import Tool
from .release_sources import RELEASE_SOURCES

RUNTIME_EXECUTABLE = "tofu"

_ARCH_ALIASES = {
    "x86_64": "amd64",
    "amd64": "amd64",
    "aarch64": "arm64",
    "arm64": "arm64",
}


def host_os() -> str:
    return platform.system().lower()


def host_arch() -> str:
    machine = platform.machine().lower()
    return _ARCH_ALIASES.get(machine, machine)


def _extract_executable(content: bytes, executable: str, target_dir: Path) -> None:
    """
    Unpack only `executable` from the archive into `target_dir`.
    The file is written into a temporary directory first and then moved in place,
    so concurrent workers never see a partially written tool.
    """
    target_dir.parent.mkdir(parents=True, exist_ok=True)
    tmp_dir = Path(tempfile.mkdtemp(dir=target_dir.parent, prefix=".tmp-"))
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            try:
                member = archive.getinfo(executable)
            except KeyError as e:
                raise CannotProceed(f"Executable {executable} not found in the archive") from e
            destination = tmp_dir / executable
            with archive.open(member) as src, open(destination, "wb") as dst:
                shutil.copyfileobj(src, dst)
        destination.chmod(0o755)

        try:
            os.rename(tmp_dir, target_dir)
        except OSError:
            # another worker unpacked the same tool first
            if not (target_dir / executable).is_file():
                raise
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)


async def resolve_tool(session: AsyncSession, tool_id: str | UUID | None) -> Tool | None:
    """
    The tool selected by an entity, or the global default one when nothing is selected.
    None means the tofu installed in the worker runtime is used.
    """
    crud = ToolCRUD(session=session)
    if not tool_id:
        return await crud.get_default()

    tool = await crud.get_by_id(tool_id)
    if tool is None:
        raise CannotProceed(f"Tool {tool_id} not found")
    return tool


@dataclass(frozen=True)
class ResolvedTool:
    path: str | None
    """Local path of the tool, None means the tofu installed in the worker runtime."""
    label: str
    """Tool name and version, e.g. "OpenTofu 1.13.0"."""


def tool_display_name(tool: Tool) -> str:
    source = RELEASE_SOURCES.get(tool.name)
    return f"{source.display_name if source else tool.name} {tool.version}"


async def resolve_tool_to_run(session: AsyncSession, tool_id: str | UUID | None) -> ResolvedTool:
    """The tool resolved by `resolve_tool`, unpacked locally, with a label for the logs."""
    tool = await resolve_tool(session, tool_id)
    if tool is None:
        return ResolvedTool(path=None, label=f"{RUNTIME_EXECUTABLE} installed on the worker")
    return ResolvedTool(path=await ensure_local_tool(session, tool.id), label=tool_display_name(tool))


async def ensure_local_tool(session: AsyncSession, tool_id: str | UUID) -> str:
    """
    Return the path to a runnable copy of the tool on this worker,
    unpacking it from the database into the local cache on first use.
    """
    crud = ToolCRUD(session=session)
    tool = await crud.get_by_id(tool_id)
    if tool is None:
        raise CannotProceed(f"Tool {tool_id} not found")

    label = f"{tool.name} {tool.version} ({tool.os}/{tool.arch})"
    # disabled tools can't be selected anymore, but entities already using them keep working
    if tool.status not in [ModelStatus.DONE, ModelStatus.DISABLED]:
        raise CannotProceed(f"Tool {label} is not downloaded yet, status: {tool.status}")

    if tool.os != host_os() or tool.arch != host_arch():
        raise CannotProceed(f"Tool {label} cannot run on this worker ({host_os()}/{host_arch()})")

    target_dir = Path(Settings().TOOL_CACHE_DIR) / tool.sha256
    target = target_dir / tool.executable
    if target.is_file():
        return str(target)

    content = await crud.get_content(tool.id)
    if not content:
        raise CannotProceed(f"Tool {label} has no content")

    if hashlib.sha256(content).hexdigest() != tool.sha256:
        raise CannotProceed(f"Tool {label} content does not match its checksum")

    await asyncio.to_thread(_extract_executable, content, tool.executable, target_dir)
    return str(target)
