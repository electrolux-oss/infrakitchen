from contextvars import ContextVar
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastmcp import FastMCP

from infrakitchen_mcp.tools.template_tools import register_template_tools


def _make_mcp_with_templates(
    response_data: Any = None,
    auth_context: ContextVar[str | None] | None = None,
) -> tuple[FastMCP, AsyncMock]:
    """Create a FastMCP instance with registered template tools and a mock client."""
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock()
    response.json.return_value = response_data if response_data is not None else []
    response.raise_for_status = MagicMock()
    client.request.return_value = response

    mcp = FastMCP("test")
    register_template_tools(mcp, client, auth_context=auth_context)
    return mcp, client


class TestRegisterTemplateTools:
    """Test tool registration."""

    @pytest.mark.asyncio
    async def test_tool_is_registered(self):
        mcp, _ = _make_mcp_with_templates()
        tools = await mcp.list_tools()
        tool_names = [t.name for t in tools]
        assert "list_templates" in tool_names

    @pytest.mark.asyncio
    async def test_tool_description_mentions_labels(self):
        mcp, _ = _make_mcp_with_templates()
        tool = await mcp.get_tool("list_templates")
        assert "labels__contains_all" in tool.description
        assert "labels" in tool.description

    @pytest.mark.asyncio
    async def test_tool_description_warns_against_unsupported_operators(self):
        mcp, _ = _make_mcp_with_templates()
        tool = await mcp.get_tool("list_templates")
        assert "DO NOT use unsupported operators" in tool.description


class TestListTemplatesExecution:
    """Test the list_templates tool execution."""

    @pytest.mark.asyncio
    async def test_calls_templates_endpoint(self):
        mcp, client = _make_mcp_with_templates(response_data=[])

        await mcp.call_tool("list_templates", {"filter": None, "range": [0, 5]})

        client.request.assert_called_once()
        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["method"] == "GET"
        assert call_kwargs["url"] == "http://internal/api/templates"

    @pytest.mark.asyncio
    async def test_passes_filter_as_json_query_param(self):
        mcp, client = _make_mcp_with_templates(response_data=[])

        await mcp.call_tool(
            "list_templates",
            {"filter": {"labels__contains_all": ["aws"]}, "range": [0, 5]},
        )

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["params"]["filter"] == '{"labels__contains_all": ["aws"]}'

    @pytest.mark.asyncio
    async def test_passes_range_as_json_query_param(self):
        mcp, client = _make_mcp_with_templates(response_data=[])

        await mcp.call_tool("list_templates", {"filter": None, "range": [0, 9]})

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["params"]["range"] == "[0, 9]"

    @pytest.mark.asyncio
    async def test_no_filter_omits_filter_param(self):
        mcp, client = _make_mcp_with_templates(response_data=[])

        await mcp.call_tool("list_templates", {"filter": None, "range": [0, 5]})

        call_kwargs = client.request.call_args.kwargs
        assert "filter" not in call_kwargs["params"]

    @pytest.mark.asyncio
    async def test_wraps_list_response_with_count(self):
        templates = [{"id": "1", "name": "t1"}, {"id": "2", "name": "t2"}]
        mcp, _ = _make_mcp_with_templates(response_data=templates)

        result = await mcp.call_tool("list_templates", {"filter": None, "range": [0, 5]})
        assert result.structured_content == {"data": templates, "count": 2}

    @pytest.mark.asyncio
    async def test_forwards_auth_header(self):
        auth_ctx: ContextVar[str | None] = ContextVar("auth", default=None)
        mcp, client = _make_mcp_with_templates(response_data=[], auth_context=auth_ctx)

        token = auth_ctx.set("Bearer test-token")
        try:
            await mcp.call_tool("list_templates", {"filter": None, "range": [0, 5]})
        finally:
            auth_ctx.reset(token)

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["headers"]["Authorization"] == "Bearer test-token"
