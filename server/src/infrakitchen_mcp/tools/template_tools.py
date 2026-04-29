from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_template_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing templates."""

    @mcp.tool(
        description=(
            "List infrastructure templates with optional filtering and pagination.\n\n"
            "Templates define reusable infrastructure patterns (e.g., AWS EC2 instances, "
            "Kubernetes deployments).\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), description (string), template (string slug), "
            "status ('enabled'|'disabled'), abstract (bool), revision_number (int), "
            "labels (list[str]), cloud_resource_types (list[str]), "
            "parents (list[TemplateShort]), children (list[TemplateShort]), "
            "configuration (object), creator (UserShort|null), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in, contains_all, any.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID string).\n"
            '    Example: {"id": "550e8400-e29b-41d4-a716-446655440000"}\n'
            "  - name: exact match or partial match with 'like'.\n"
            '    Example: {"name": "my_template"}\n'
            '    Example: {"name__like": "aws"} — case-insensitive substring match.\n'
            "  - template: exact match or 'like' on the template slug.\n"
            '    Example: {"template__like": "ec2"}\n'
            "  - status: exact match. Values: 'enabled' or 'disabled'.\n"
            '    Example: {"status": "enabled"}\n'
            "  - abstract: exact match (boolean).\n"
            '    Example: {"abstract": true}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            "    Matches templates that have ALL specified labels.\n"
            '    Example: {"labels__contains_all": ["aws"]}\n'
            '    Example: {"labels__contains_all": ["aws", "production"]}\n'
            "  - cloud_resource_types: use 'contains_all' — list of strings.\n"
            '    Example: {"cloud_resource_types__contains_all": ["aws_instance"]}\n'
            "  - children / parents: use 'any' — list of template UUIDs.\n"
            '    Example: {"children__any": ["<child-uuid>"]}\n\n'
            "Multiple filters can be combined in one object:\n"
            '  {"status": "enabled", "labels__contains_all": ["aws"]}\n\n'
            "DO NOT use unsupported operators for a field (e.g., 'contains_all' on 'name').\n"
            "Pass null/None to skip filtering and return all templates.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Example: [0, 9] returns the first 10 templates.\n"
            "- Example: [10, 19] returns the next 10.\n"
            "- Default is [0, 5] (first 6 templates).\n"
            "- To get more results, increase the end index.\n\n"
            "RESPONSE:\n"
            "- Returns a list of template objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='templates' and the template id "
            "to retrieve full details of a specific template."
        ),
    )
    async def list_templates(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List infrastructure templates with optional filtering and pagination."""
        return await list_entities_adapter(client, "templates", auth_context, filter, range)
