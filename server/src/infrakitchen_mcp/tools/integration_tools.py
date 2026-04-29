from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_integration_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing integrations."""

    @mcp.tool(
        description=(
            "List integrations with optional filtering and pagination.\n\n"
            "Integrations connect InfraKitchen to external cloud providers and "
            "Git services (e.g., AWS, GCP, Azure, GitHub, GitLab, Bitbucket, "
            "MongoDB Atlas, Datadog). Each integration stores credentials and "
            "provider-specific configuration.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), description (string), "
            "integration_type ('git'|'cloud'), "
            "integration_provider ('aws'|'azurerm'|'gcp'|'azure_devops'|"
            "'azure_devops_ssh'|'github'|'github_ssh'|'gitlab'|'bitbucket'|"
            "'bitbucket_ssh'|'git_public'|'mongodb_atlas'|'datadog'), "
            "status ('enabled'|'disabled'), revision_number (int), "
            "labels (list[str]), configuration (object — provider-specific), "
            "creator (UserShort), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in, contains_all.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID string).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - name: exact match or 'like'.\n"
            '    Example: {"name__like": "aws"}\n'
            "  - integration_type: exact match.\n"
            "    Values: 'git', 'cloud'.\n"
            '    Example: {"integration_type": "cloud"}\n'
            "  - integration_provider: exact match.\n"
            '    Example: {"integration_provider": "aws"}\n'
            "  - status: exact match. Values: 'enabled', 'disabled'.\n"
            '    Example: {"status": "enabled"}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            '    Example: {"labels__contains_all": ["production"]}\n\n'
            "Multiple filters can be combined:\n"
            '  {"integration_type": "cloud", "labels__contains_all": ["aws"]}\n\n'
            "Pass null/None to skip filtering and return all integrations.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of integration objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='integrations' and the id "
            "to retrieve full details."
        ),
    )
    async def list_integrations(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List integrations with optional filtering and pagination."""
        return await list_entities_adapter(client, "integrations", auth_context, filter, range)
