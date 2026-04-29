from contextvars import ContextVar
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import httpx
import pytest
from fastmcp import FastMCP

from infrakitchen_mcp.tools.resource_tools import register_resource_tools


def _make_mcp_with_resources(
    response_data: Any = None,
    auth_context: ContextVar[str | None] | None = None,
) -> tuple[FastMCP, AsyncMock]:
    """Create a FastMCP instance with registered resource tools and a mock client."""
    client = AsyncMock(spec=httpx.AsyncClient)
    response = MagicMock()
    response.json.return_value = response_data if response_data is not None else []
    response.raise_for_status = MagicMock()
    client.request.return_value = response

    mcp = FastMCP("test")
    register_resource_tools(mcp, client, auth_context=auth_context)
    return mcp, client


class TestRegisterResourceTools:
    """Test resource tool registration."""

    @pytest.mark.asyncio
    async def test_tool_is_registered(self):
        mcp, _ = _make_mcp_with_resources()
        tools = await mcp.list_tools()
        tool_names = [t.name for t in tools]
        assert "list_resources" in tool_names

    @pytest.mark.asyncio
    async def test_tool_description_mentions_state(self):
        mcp, _ = _make_mcp_with_resources()
        tool = await mcp.get_tool("list_resources")
        assert "state" in tool.description
        assert "provisioned" in tool.description

    @pytest.mark.asyncio
    async def test_tool_description_mentions_template_relationship(self):
        mcp, _ = _make_mcp_with_resources()
        tool = await mcp.get_tool("list_resources")
        assert "template__name__like" in tool.description

    @pytest.mark.asyncio
    async def test_tool_description_warns_against_unsupported_operators(self):
        mcp, _ = _make_mcp_with_resources()
        tool = await mcp.get_tool("list_resources")
        assert "DO NOT use unsupported operators" in tool.description


class TestListResourcesExecution:
    """Test the list_resources tool execution."""

    @pytest.mark.asyncio
    async def test_calls_resources_endpoint(self):
        mcp, client = _make_mcp_with_resources(response_data=[])

        await mcp.call_tool("list_resources", {"filter": None, "range": [0, 5]})

        client.request.assert_called_once()
        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["method"] == "GET"
        assert call_kwargs["url"] == "http://internal/api/resources"

    @pytest.mark.asyncio
    async def test_passes_filter_as_json_query_param(self):
        mcp, client = _make_mcp_with_resources(response_data=[])

        await mcp.call_tool(
            "list_resources",
            {"filter": {"state": "provisioned"}, "range": [0, 5]},
        )

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["params"]["filter"] == '{"state": "provisioned"}'

    @pytest.mark.asyncio
    async def test_passes_range_as_json_query_param(self):
        mcp, client = _make_mcp_with_resources(response_data=[])

        await mcp.call_tool("list_resources", {"filter": None, "range": [0, 9]})

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["params"]["range"] == "[0, 9]"

    @pytest.mark.asyncio
    async def test_no_filter_omits_filter_param(self):
        mcp, client = _make_mcp_with_resources(response_data=[])

        await mcp.call_tool("list_resources", {"filter": None, "range": [0, 5]})

        call_kwargs = client.request.call_args.kwargs
        assert "filter" not in call_kwargs["params"]

    @pytest.mark.asyncio
    async def test_wraps_list_response_with_count(self):
        resources = [{"id": "1", "name": "r1"}, {"id": "2", "name": "r2"}]
        mcp, _ = _make_mcp_with_resources(response_data=resources)

        result = await mcp.call_tool("list_resources", {"filter": None, "range": [0, 5]})
        assert result.structured_content == {"data": resources, "count": 2}

    @pytest.mark.asyncio
    async def test_forwards_auth_header(self):
        auth_ctx: ContextVar[str | None] = ContextVar("auth", default=None)
        mcp, client = _make_mcp_with_resources(response_data=[], auth_context=auth_ctx)

        token = auth_ctx.set("Bearer res-token")
        try:
            await mcp.call_tool("list_resources", {"filter": None, "range": [0, 5]})
        finally:
            auth_ctx.reset(token)

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["headers"]["Authorization"] == "Bearer res-token"
