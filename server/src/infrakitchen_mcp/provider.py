from collections.abc import Sequence
from contextvars import ContextVar
import json
from typing import Any

from fastmcp.tools.base import Tool
import httpx
from fastapi import FastAPI
from fastapi.routing import APIRoute

from fastmcp.server.providers.base import Provider

from infrakitchen_mcp.utils import compress_dict

from .dispatch_framework import (
    DispatchTool,
    GroupDefinition,
    HTTPExecutor,
)
from .registry import EndpointRegistry, registry as default_registry


class GroupedMCPProvider(Provider):
    """Builds a unified MCP tool from a single GroupDefinition."""

    def __init__(
        self,
        group: GroupDefinition[Any],
        app: FastAPI,
        client: httpx.AsyncClient,
        *,
        base_url: str = "",
        registry: EndpointRegistry | None = None,
        auth_context: ContextVar[str | None] | None = None,
    ):
        super().__init__()
        self._group = group
        self._registry = registry or default_registry
        self._tool: Tool | None = None

        executor = HTTPExecutor(client, base_url, auth_context=auth_context)
        for route in app.routes:
            if isinstance(route, APIRoute):
                method = next(iter(route.methods or {"GET"}))
                executor.register_route(route.endpoint, method, route.path)

        self._build_tool(executor)

    def _build_tool(self, executor: HTTPExecutor) -> None:
        """Build dispatch tool from registry for this group."""
        adapters = self._registry.get_adapters(self._group)

        if not adapters:
            return

        self._tool = DispatchTool(
            group=self._group,
            adapters=adapters,
            executor=executor,
        )

    async def _list_tools(self) -> Sequence[Tool]:
        return [self._tool] if self._tool else []

    async def _get_tool(self, name: str, version=None) -> Tool | None:
        if self._tool and self._tool.name == name:
            return self._tool
        return None


async def list_entities_adapter(
    client: httpx.AsyncClient,
    endpoint: str,
    auth_context: ContextVar[str | None] | None,
    filter: dict[str, Any] | None,
    range: tuple[int, int],
) -> dict[str, Any]:
    """Shared HTTP helper for listing entities."""
    headers: dict[str, str] = {}
    if auth_context is not None:
        auth_value = auth_context.get(None)
        if auth_value:
            headers["Authorization"] = auth_value

    query_params: dict[str, str] = {}
    if filter is not None:
        query_params["filter"] = json.dumps(filter)
    query_params["range"] = json.dumps(list(range))

    response = await client.request(
        method="GET",
        url=f"http://internal/api/{endpoint}",
        params=query_params,
        headers=headers if headers else None,
    )
    response.raise_for_status()

    data = response.json()
    if isinstance(data, list):
        return {"data": [compress_dict(item) for item in data], "count": len(data)}
    return data


async def mutate_entity_adapter(
    client: httpx.AsyncClient,
    method: str,
    endpoint: str,
    auth_context: ContextVar[str | None] | None,
    body: dict[str, Any],
) -> dict[str, Any]:
    """Shared HTTP helper for creating or updating entities."""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if auth_context is not None:
        auth_value = auth_context.get(None)
        if auth_value:
            headers["Authorization"] = auth_value

    response = await client.request(
        method=method,
        url=f"http://internal/api/{endpoint}",
        content=json.dumps(body),
        headers=headers,
    )
    response.raise_for_status()
    return response.json()
