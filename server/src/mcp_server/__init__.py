"""
MCP integration: GraphQL-backed read-only tools over the InfraKitchen API.
"""

from .server import setup_mcp_server

__all__ = [
    "setup_mcp_server",
]
