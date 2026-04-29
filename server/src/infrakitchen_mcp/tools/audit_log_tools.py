from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_audit_log_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing audit logs."""

    @mcp.tool(
        description=(
            "List audit log entries with optional filtering and pagination.\n\n"
            "Audit logs record every create, update, and delete action performed "
            "on entities in InfraKitchen, including who did it and when.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), model (string — entity type name, e.g. 'templates', "
            "'resources'), user_id (UUID), action (string — e.g. 'create', "
            "'update', 'delete'), entity_id (UUID — ID of the affected entity), "
            "created_at (datetime), creator (UserShort|null), "
            "revision_number (int|null).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID string).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - model: exact match or 'like'. The entity type name.\n"
            '    Example: {"model": "templates"}\n'
            '    Example: {"model__like": "resource"}\n'
            "  - action: exact match. Values: 'create', 'update', 'delete'.\n"
            '    Example: {"action": "create"}\n'
            "  - user_id: exact match (UUID of the user who performed the action).\n"
            '    Example: {"user_id": "<user-uuid>"}\n'
            "  - entity_id: exact match (UUID of the affected entity).\n"
            '    Example: {"entity_id": "<entity-uuid>"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"model": "resources", "action": "update"}\n\n'
            "Pass null/None to skip filtering and return all audit logs.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Example: [0, 9] returns the first 10 entries.\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of audit log objects.\n"
            "- Use get_entity with entity_type='audit_logs' and the entity_id "
            "to retrieve a specific audit log entry."
        ),
    )
    async def list_audit_logs(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List audit log entries with optional filtering and pagination."""
        return await list_entities_adapter(client, "audit_logs", auth_context, filter, range)
