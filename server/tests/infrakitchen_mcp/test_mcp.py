"""Tests for MCP server setup."""

from typing import Any
import pytest
from unittest.mock import AsyncMock, MagicMock

import httpx
from fastapi import FastAPI
from fastapi.routing import APIRoute, Mount

from infrakitchen_mcp.server import DEFAULT_DOCS_DIR, setup_mcp_server
from infrakitchen_mcp.dispatch_framework import (
    EndpointAdapter,
    GetOneParams,
    HTTPExecutor,
    get_one_group,
    list_entities_group,
)
from infrakitchen_mcp.registry import EndpointRegistry
from infrakitchen_mcp.provider import GroupedMCPProvider


class TestDocsDirectory:
    """Validate documentation directory configuration."""

    def test_default_docs_dir_exists(self):
        """DEFAULT_DOCS_DIR must point to an existing directory with markdown files."""
        assert DEFAULT_DOCS_DIR.exists(), f"Docs directory does not exist: {DEFAULT_DOCS_DIR}"
        assert DEFAULT_DOCS_DIR.is_dir(), f"Docs path is not a directory: {DEFAULT_DOCS_DIR}"

        md_files = list(DEFAULT_DOCS_DIR.rglob("*.md"))
        assert len(md_files) > 0, f"No markdown files found in {DEFAULT_DOCS_DIR}"


class TestEndpointAdapter:
    """Test parameter transformation logic."""

    def test_transform_with_renames(self):
        """Adapter correctly renames parameters."""
        adapter = EndpointAdapter(
            entity_name="workspaces",
            endpoint_fn=lambda: None,
            param_renames={"id": "workspace_id"},
        )

        result = adapter.transform(GetOneParams(id="ws-123"))
        assert result == {"workspace_id": "ws-123"}

    def test_transform_includes_static_params(self):
        """Adapter includes static parameters in output."""
        adapter = EndpointAdapter(
            entity_name="resources",
            endpoint_fn=lambda: None,
            static_params={"include_deleted": False},
        )

        result = adapter.transform(GetOneParams(id="123"))
        assert result == {"id": "123", "include_deleted": False}


class TestHTTPExecutor:
    """Test HTTP execution logic."""

    @pytest.fixture
    def executor_with_mock_client(self):
        client = AsyncMock(spec=httpx.AsyncClient)
        response = MagicMock()
        response.json.return_value = {"id": "123"}
        response.raise_for_status = MagicMock()
        client.request.return_value = response
        return HTTPExecutor(client, base_url="http://api"), client

    @pytest.mark.asyncio
    async def test_path_parameter_substitution(self, executor_with_mock_client):
        """Path parameters are substituted correctly."""
        executor, client = executor_with_mock_client

        def get_resource(resource_id: str):
            pass

        executor.register_route(get_resource, "GET", "/resources/{resource_id}")
        await executor.execute(get_resource, {"resource_id": "abc-123"})

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["url"] == "http://api/resources/abc-123"

    @pytest.mark.asyncio
    async def test_query_params_json_encoded(self, executor_with_mock_client):
        """Dict/list query params are JSON encoded."""
        executor, client = executor_with_mock_client

        def list_resources(filter: dict[Any, Any]):
            pass

        executor.register_route(list_resources, "GET", "/resources")
        await executor.execute(list_resources, {"filter": {"status": "active"}})

        call_kwargs = client.request.call_args.kwargs
        assert call_kwargs["params"]["filter"] == '{"status": "active"}'

    @pytest.mark.asyncio
    async def test_unregistered_route_raises(self, executor_with_mock_client):
        """Calling unregistered endpoint raises clear error."""
        executor, _ = executor_with_mock_client

        with pytest.raises(ValueError, match="No route registered"):
            await executor.execute(lambda: None, {})


class TestGroupedMCPProvider:
    """Test provider creates tools from registry."""

    def test_creates_tool_for_get_one_group(self):
        """Provider creates dispatch tool for get_one_group group."""
        app = FastAPI()

        @app.get("/workspaces/{workspace_id}")
        async def get_workspace(workspace_id: str):
            return {}

        registry = EndpointRegistry()
        registry.register(get_one_group, "workspaces", get_workspace, param_renames={"id": "workspace_id"})

        provider = GroupedMCPProvider(
            group=get_one_group,
            app=app,
            client=AsyncMock(spec=httpx.AsyncClient),
            registry=registry,
        )
        assert provider._tool is not None
        assert provider._tool.name == "get_entity"

    def test_creates_tool_for_list_group(self):
        """Provider creates dispatch tool for list_entities_group group."""
        app = FastAPI()

        @app.get("/workspaces")
        async def list_workspaces():
            return []

        registry = EndpointRegistry()
        registry.register(list_entities_group, "workspaces", list_workspaces)

        provider = GroupedMCPProvider(
            group=list_entities_group,
            app=app,
            client=AsyncMock(spec=httpx.AsyncClient),
            registry=registry,
        )
        assert provider._tool is not None
        assert provider._tool.name == "list_entities"

    def test_no_tool_when_no_adapters_registered(self):
        """Provider has no tool when registry is empty for the group."""
        app = FastAPI()
        registry = EndpointRegistry()

        provider = GroupedMCPProvider(
            group=get_one_group,
            app=app,
            client=AsyncMock(spec=httpx.AsyncClient),
            registry=registry,
        )
        assert provider._tool is None


class TestSetupMcpServer:
    """Test MCP server setup and mounting."""

    def test_mounts_at_specified_path(self):
        """MCP server is mounted at the specified path."""
        app = FastAPI()
        setup_mcp_server(app, mount_path="/api/mcp")

        mount_paths = [r.path for r in app.routes if isinstance(r, Mount)]
        assert "/api/mcp" in mount_paths

    def test_fastapi_routes_still_work(self):
        """Original FastAPI routes remain accessible after mounting."""
        app = FastAPI()

        @app.get("/health")
        async def health():
            return {"ok": True}

        setup_mcp_server(app, mount_path="/mcp")

        route_paths = [r.path for r in app.routes if isinstance(r, APIRoute)]
        assert "/health" in route_paths
