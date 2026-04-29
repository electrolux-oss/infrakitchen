from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_user_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing users."""

    @mcp.tool(
        description=(
            "List users with optional filtering and pagination.\n\n"
            "Users are accounts in InfraKitchen, authenticated via an auth provider. "
            "Users can have primary/secondary account relationships for "
            "multi-provider setups.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), email (string|null), identifier (string — unique login), "
            "first_name (string|null), last_name (string|null), "
            "display_name (string|null), provider (string — auth provider name), "
            "is_primary (bool|null), "
            "secondary_accounts (list[UserShort]), "
            "primary_account (list[UserShort]), "
            "deactivated (bool), description (string|null), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - identifier: exact match or 'like'.\n"
            '    Example: {"identifier__like": "john"}\n'
            "  - email: exact match or 'like'.\n"
            '    Example: {"email__like": "@example.com"}\n'
            "  - provider: exact match (auth provider name).\n"
            '    Example: {"provider": "microsoft"}\n'
            "  - deactivated: exact match (boolean).\n"
            '    Example: {"deactivated": false}\n'
            "  - display_name: exact match or 'like'.\n"
            '    Example: {"display_name__like": "John"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"provider": "microsoft", "deactivated": false}\n\n'
            "Pass null/None to skip filtering and return all users.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of user objects.\n"
            "- Use get_entity with entity_type='users' and the id "
            "to retrieve full details."
        ),
    )
    async def list_users(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List users with optional filtering and pagination."""
        return await list_entities_adapter(client, "users", auth_context, filter, range)
