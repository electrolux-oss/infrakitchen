from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_log_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing logs."""

    @mcp.tool(
        description=(
            "List execution logs with optional filtering and pagination.\n\n"
            "Logs capture output from infrastructure provisioning, destruction, "
            "and other operations. Each log entry is tied to a specific entity "
            "and revision.\n\n"
            "RESPONSE FIELDS:\n"
            "  entity_id (UUID — the entity this log belongs to), "
            "entity (string — entity type, e.g. 'resource'), "
            "revision (int), audit_log_id (UUID|null), "
            "level (string — 'info', 'error', 'warn', 'debug'), "
            "data (string — log content/message), "
            "created_at (datetime), execution_start (int), "
            "expire_at (datetime|null), trace_id (UUID|null).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields and their operators:\n"
            "  - entity_id: exact match (UUID of the entity the log belongs to).\n"
            '    Example: {"entity_id": "<resource-uuid>"}\n'
            "  - entity: exact match (entity type name).\n"
            '    Example: {"entity": "resource"}\n'
            "  - level: exact match.\n"
            "    Values: 'info', 'error', 'warn', 'debug'.\n"
            '    Example: {"level": "error"}\n'
            "  - audit_log_id: exact match (UUID).\n"
            '    Example: {"audit_log_id": "<audit-log-uuid>"}\n'
            "  - trace_id: exact match (UUID).\n"
            '    Example: {"trace_id": "<trace-uuid>"}\n'
            "  - revision: exact match (int).\n"
            '    Example: {"revision": 2}\n'
            "  - data: partial match with 'like'.\n"
            '    Example: {"data__like": "error"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"entity_id": "<uuid>", "level": "error"}\n\n'
            "Pass null/None to skip filtering and return all logs.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of log objects.\n"
            "- Use get_entity with entity_type='logs' and the entity_id "
            "to retrieve a specific log entry."
        ),
    )
    async def list_logs(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List execution logs with optional filtering and pagination."""
        return await list_entities_adapter(client, "logs", auth_context, filter, range)
