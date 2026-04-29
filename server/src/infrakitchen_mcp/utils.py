from typing import Any
import json

from fastmcp.tools.base import ToolResult
from fastmcp.tools.tool_transform import forward_raw
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


def compress_dict(entity: dict[str, Any]) -> dict[str, Any]:
    """Keep top-level keys, compress all nested structures."""
    if not isinstance(entity, dict):
        return entity
    return {k: _compress_value(v) for k, v in entity.items()}


async def compress_results_fn(**kwargs: Any) -> ToolResult:
    """Transform function that compresses nested structures."""
    result = await forward_raw(**kwargs)

    if not result.structured_content:
        return result

    data = result.structured_content
    if isinstance(data, dict):
        compressed = {}
        for k, v in data.items():
            if isinstance(v, list):
                compressed[k] = [compress_dict(item) for item in v]
            else:
                compressed[k] = _compress_value(v)

        return ToolResult(
            content=[TextContent(type="text", text=json.dumps(compressed, indent=2))],
            structured_content=compressed,
        )

    return result
