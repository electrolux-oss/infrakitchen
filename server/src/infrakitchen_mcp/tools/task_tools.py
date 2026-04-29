from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_task_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing tasks."""

    @mcp.tool(
        description=(
            "List tasks with optional filtering and pagination.\n\n"
            "Tasks track asynchronous operations on entities (provisioning, "
            "destruction, etc.). Each task records the current state and status "
            "of an operation.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), entity_id (UUID — the entity being operated on), "
            "entity (string — entity type, e.g. 'resource', 'storage'), "
            "state ('provision'|'provisioned'|'destroy'|'destroyed'|null), "
            "status ('queued'|'in_progress'|'done'|'error'|'unknown'|"
            "'approval_pending'|'pending'|'rejected'|'ready'), "
            "created_by (UserDTO|UUID), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - entity_id: exact match (UUID of the entity).\n"
            '    Example: {"entity_id": "<resource-uuid>"}\n'
            "  - entity: exact match (entity type name).\n"
            '    Example: {"entity": "resource"}\n'
            "  - state: exact match.\n"
            "    Values: 'provision', 'provisioned', 'destroy', 'destroyed'.\n"
            '    Example: {"state": "provision"}\n'
            "  - status: exact match.\n"
            "    Values: 'queued', 'in_progress', 'done', 'error', 'unknown', "
            "'approval_pending', 'pending', 'rejected', 'ready'.\n"
            '    Example: {"status": "in_progress"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"entity": "resource", "status": "error"}\n\n'
            "Pass null/None to skip filtering and return all tasks.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of task objects.\n"
            "- Use get_entity with entity_type='tasks' and the id "
            "to retrieve a specific task."
        ),
    )
    async def list_tasks(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List tasks with optional filtering and pagination."""
        return await list_entities_adapter(client, "tasks", auth_context, filter, range)
