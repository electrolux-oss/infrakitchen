from typing import Any
from collections.abc import Sequence
import json

from fastmcp.server.transforms import Transform
from fastmcp.tools.tool import Tool, ToolResult
from fastmcp.tools.tool_transform import TransformedTool, forward_raw
from mcp.types import TextContent


def _compress_value(value: Any) -> Any:
    """Compress any list or dict, keep primitives."""
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, list):
        return f"[{len(value)} items]"
    if isinstance(value, dict):
        return f"{{{len(value)} keys}}"
    return str(value)


def _compress_dict(entity: dict[str, Any]) -> dict[str, Any]:
    """Keep top-level keys, compress all nested structures."""
    if not isinstance(entity, dict):
        return entity
    return {k: _compress_value(v) for k, v in entity.items()}


async def _compress_results_fn(**kwargs: Any) -> ToolResult:
    """Transform function that compresses nested structures."""
    result = await forward_raw(**kwargs)

    if not result.structured_content:
        return result

    data = result.structured_content
    if isinstance(data, dict):
        compressed = {}
        for k, v in data.items():
            if isinstance(v, list):
                compressed[k] = [_compress_dict(item) for item in v]
            else:
                compressed[k] = _compress_value(v)

        return ToolResult(
            content=[TextContent(type="text", text=json.dumps(compressed, indent=2))],
            structured_content=compressed,
        )

    return result


class CompressResultsTransform(Transform):
    """Transform that compresses list results for summarization."""

    def __init__(self, description_suffix: str = "\n\nResults are summarized; use get_entity for full details."):
        self._description_suffix = description_suffix

    async def list_tools(self, tools: Sequence[Tool]) -> Sequence[Tool]:
        return [self._wrap_tool(t) for t in tools]

    async def get_tool(self, name: str, call_next, *, version=None) -> Tool | None:
        tool = await call_next(name, version=version)
        return self._wrap_tool(tool) if tool else None

    def _wrap_tool(self, tool: Tool) -> Tool:
        return TransformedTool.from_tool(
            tool,
            transform_fn=_compress_results_fn,
            description=f"{tool.description}{self._description_suffix}",
        )
