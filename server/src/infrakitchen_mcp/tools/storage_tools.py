from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_storage_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing storages."""

    @mcp.tool(
        description=(
            "List state storages with optional filtering and pagination.\n\n"
            "Storages define where infrastructure state files are stored "
            "(e.g., AWS S3 buckets, GCP Cloud Storage, Azure Blob Storage). "
            "They are linked to an integration for authentication.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), description (string), "
            "storage_type ('tofu'), "
            "storage_provider ('aws'|'azurerm'|'gcp'), "
            "state ('provision'|'provisioned'|'destroy'|'destroyed'), "
            "status ('in_progress'|'done'|'error'|'ready'|'queued'), "
            "revision_number (int), "
            "integration (IntegrationShort), "
            "configuration (object — provider-specific), "
            "labels (list[str]), creator (UserShort), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in, contains_all.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - name: exact match or 'like'.\n"
            '    Example: {"name__like": "prod"}\n'
            "  - storage_type: exact match. Values: 'tofu'.\n"
            '    Example: {"storage_type": "tofu"}\n'
            "  - storage_provider: exact match.\n"
            "    Values: 'aws', 'azurerm', 'gcp'.\n"
            '    Example: {"storage_provider": "aws"}\n'
            "  - state: exact match.\n"
            "    Values: 'provision', 'provisioned', 'destroy', 'destroyed'.\n"
            '    Example: {"state": "provisioned"}\n'
            "  - status: exact match.\n"
            "    Values: 'in_progress', 'done', 'error', 'ready', 'queued'.\n"
            '    Example: {"status": "ready"}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            '    Example: {"labels__contains_all": ["production"]}\n'
            "  - integration (relationship): filter by integration fields.\n"
            '    Example: {"integration__name__like": "aws"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"storage_provider": "aws", "state": "provisioned"}\n\n'
            "Pass null/None to skip filtering and return all storages.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of storage objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='storages' and the id "
            "to retrieve full details."
        ),
    )
    async def list_storages(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List state storages with optional filtering and pagination."""
        return await list_entities_adapter(client, "storages", auth_context, filter, range)
