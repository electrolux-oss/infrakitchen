from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_role_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing roles (permissions)."""

    @mcp.tool(
        description=(
            "List permission/role entries with optional filtering and pagination.\n\n"
            "Roles define access control policies using Casbin-style rules. "
            "Each entry maps a subject (user/role) to an object and action.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), ptype ('p' for policy | 'g' for group/role assignment), "
            "v0 (string|null — subject), v1 (string|null — object/role), "
            "v2 (string|null — action: 'read'|'write'|'admin'), "
            "v3..v5 (string|null — additional rule fields), "
            "creator (UserShort|null), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - ptype: exact match. Values: 'p' (policy), 'g' (group).\n"
            '    Example: {"ptype": "g"}\n'
            "  - v0: exact match or 'like' (subject — usually user UUID or role name).\n"
            '    Example: {"v0": "<user-uuid>"}\n'
            "  - v1: exact match or 'like' (object or role name).\n"
            '    Example: {"v1": "admin"}\n'
            "  - v2: exact match (action).\n"
            '    Example: {"v2": "read"}\n\n'
            "Pass null/None to skip filtering and return all roles.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of permission/role objects."
        ),
    )
    async def list_roles(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List permission/role entries with optional filtering and pagination."""
        return await list_entities_adapter(client, "permissions/roles", auth_context, filter, range)
