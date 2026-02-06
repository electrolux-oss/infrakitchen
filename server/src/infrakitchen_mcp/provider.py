from collections.abc import Sequence
from contextvars import ContextVar
from typing import Any

import httpx
from fastapi import FastAPI
from fastapi.routing import APIRoute

from fastmcp.server.providers.base import Provider
from fastmcp.tools.tool import Tool

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
