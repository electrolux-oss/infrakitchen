from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_auth_provider_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing auth providers."""

    @mcp.tool(
        description=(
            "List authentication providers with optional filtering and pagination.\n\n"
            "Auth providers define how users authenticate with InfraKitchen "
            "(e.g., Microsoft Entra ID, GitHub OAuth, guest access, Backstage, "
            "service accounts).\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), description (string), "
            "enabled (bool), auth_provider (string — 'microsoft'|'github'|"
            "'guest'|'backstage'|'ik_service_account'), "
            "configuration (object — provider-specific config), "
            "filter_by_domain (list[str]), "
            "creator (UserShort|null), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID string).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - name: exact match or 'like'.\n"
            '    Example: {"name": "GitHub OAuth"}\n'
            '    Example: {"name__like": "github"}\n'
            "  - auth_provider: exact match.\n"
            "    Values: 'microsoft', 'github', 'guest', 'backstage', "
            "'ik_service_account'.\n"
            '    Example: {"auth_provider": "microsoft"}\n'
            "  - enabled: exact match (boolean).\n"
            '    Example: {"enabled": true}\n\n'
            "Pass null/None to skip filtering and return all auth providers.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of auth provider objects.\n"
            "- Use get_entity with entity_type='auth_providers' and the id "
            "to retrieve full details."
        ),
    )
    async def list_auth_providers(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List authentication providers with optional filtering and pagination."""
        return await list_entities_adapter(client, "auth_providers", auth_context, filter, range)
