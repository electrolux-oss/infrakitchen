"""
MCP integration for grouping FastAPI endpoints into unified tools.
"""

from .dispatch_framework import get_one_group, list_entities_group, GetOneParams, ListParams
from .registry import mcp_group, registry, EndpointRegistry
from .provider import GroupedMCPProvider
from .server import setup_mcp_server

__all__ = [
    "get_one_group",
    "list_entities_group",
    "GetOneParams",
    "ListParams",
    "mcp_group",
    "registry",
    "EndpointRegistry",
    "GroupedMCPProvider",
    "setup_mcp_server",
]
