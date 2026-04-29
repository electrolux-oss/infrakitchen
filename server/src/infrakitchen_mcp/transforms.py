from collections.abc import Sequence

from fastmcp.server.transforms import Transform
from fastmcp.tools.base import Tool
from fastmcp.tools.tool_transform import TransformedTool

from infrakitchen_mcp.utils import compress_results_fn


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
            transform_fn=compress_results_fn,
            description=f"{tool.description}{self._description_suffix}",
        )
