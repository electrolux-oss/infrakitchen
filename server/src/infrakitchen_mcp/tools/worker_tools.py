from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_worker_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing workers."""

    @mcp.tool(
        description=(
            "List workers with optional filtering and pagination.\n\n"
            "Workers are execution agents that run infrastructure operations "
            "(provisioning, destruction, etc.). Each worker reports its "
            "availability status.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), host (string — hostname/IP), "
            "host_metadata (dict — key-value metadata about the host), "
            "status ('free'|'busy'), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - name: exact match or 'like'.\n"
            '    Example: {"name__like": "worker"}\n'
            "  - host: exact match or 'like'.\n"
            '    Example: {"host__like": "10.0"}\n'
            "  - status: exact match.\n"
            "    Values: 'free', 'busy'.\n"
            '    Example: {"status": "free"}\n\n'
            "Pass null/None to skip filtering and return all workers.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of worker objects.\n"
            "- Use get_entity with entity_type='workers' and the id "
            "to retrieve full details."
        ),
    )
    async def list_workers(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List workers with optional filtering and pagination."""
        return await list_entities_adapter(client, "workers", auth_context, filter, range)
