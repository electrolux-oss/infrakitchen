from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter, mutate_entity_adapter


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

    @mcp.tool(
        description=(
            "Create a new infrastructure template.\n\n"
            "REQUIRED FIELDS:\n"
            "  - name (string): Display name for the template.\n"
            "  - template (string): Unique slug identifier. Must match [a-zA-Z0-9_]+. "
            "Will be lowercased automatically. This field is immutable after creation.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - description (string): Human-readable short description. Default: ''.\n"
            "  - documentation (string): Human-readable documentation in markdown format. Default: ''.\n"
            "  - parents (list[UUID]): List of parent template UUIDs for inheritance. Default: [].\n"
            "  - children (list[UUID]): List of child template UUIDs. Default: [].\n"
            "  - cloud_resource_types (list[string]): Cloud resource types this template manages "
            "(e.g., 'aws_instance', 'azurerm_resource_group'). Default: [].\n"
            "  - labels (list[string]): Freeform labels for categorization "
            "(e.g., ['aws', 'production']). Default: [].\n"
            "  - abstract (bool): If true, this template cannot be used directly to create "
            "resources — it serves as a base for other templates. Default: false.\n"
            "  - configuration (object): Template configuration with optional keys:\n"
            "      - one_resource_per_integration (list[string]): Integration provider types "
            "that allow only one resource per integration. "
            "Values: 'aws', 'azurerm', 'gcp', 'github', 'gitlab', etc.\n"
            "      - allowed_provider_integration_types (list[string]): Restrict which "
            "integration provider types can be used. Empty list means all allowed.\n"
            "      - naming_convention (string|null): Naming pattern for resources, "
            "e.g., 'my-resource-{variable}'. Default: null.\n\n"
            "EXAMPLE:\n"
            '  {"name": "AWS EC2 Instance", "template": "aws_ec2", '
            '"cloud_resource_types": ["aws_instance"], "labels": ["aws", "compute"]}\n\n'
            "RESPONSE:\n"
            "  Returns the created template object with all fields including generated "
            "id, created_at, updated_at, status, and revision_number."
        ),
    )
    async def create_template(
        name: str,
        template: str,
        description: str = "",
        documentation: str = "",
        parents: list[str] | None = None,
        children: list[str] | None = None,
        cloud_resource_types: list[str] | None = None,
        labels: list[str] | None = None,
        abstract: bool = False,
        configuration: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create a new infrastructure template."""
        body: dict[str, Any] = {
            "name": name,
            "template": template,
            "description": description,
            "documentation": documentation,
            "abstract": abstract,
        }
        if parents is not None:
            body["parents"] = parents
        if children is not None:
            body["children"] = children
        if cloud_resource_types is not None:
            body["cloud_resource_types"] = cloud_resource_types
        if labels is not None:
            body["labels"] = labels
        if configuration is not None:
            body["configuration"] = configuration
        return await mutate_entity_adapter(client, "POST", "templates", auth_context, body)

    @mcp.tool(
        description=(
            "Update an existing infrastructure template.\n\n"
            "REQUIRED FIELDS:\n"
            "  - template_id (string): UUID of the template to update.\n"
            "  - name (string): Updated display name for the template.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - description (string): Updated short description. Default: ''.\n"
            "  - documentation (string): Updated documentation in markdown format. Default: ''.\n"
            "  - parents (list[UUID]): Updated list of parent template UUIDs. Default: [].\n"
            "  - children (list[UUID]): Updated list of child template UUIDs. Default: [].\n"
            "  - cloud_resource_types (list[string]): Updated cloud resource types. Default: [].\n"
            "  - labels (list[string]): Updated labels. Default: [].\n"
            "  - configuration (object): Updated template configuration. See create_template "
            "for configuration structure.\n\n"
            "NOTE: The 'template' slug and 'abstract' flag cannot be changed after creation.\n"
            "NOTE: This is a full update — all optional list fields default to empty. "
            "To preserve existing values, include them in the request.\n\n"
            "EXAMPLE:\n"
            '  {"template_id": "550e8400-...", "name": "AWS EC2 v2", '
            '"labels": ["aws", "compute", "v2"]}\n\n'
            "RESPONSE:\n"
            "  Returns the updated template object with all fields."
        ),
    )
    async def update_template(
        template_id: str,
        name: str,
        description: str = "",
        documentation: str = "",
        parents: list[str] | None = None,
        children: list[str] | None = None,
        cloud_resource_types: list[str] | None = None,
        labels: list[str] | None = None,
        configuration: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Update an existing infrastructure template."""
        body: dict[str, Any] = {
            "name": name,
            "description": description,
            "documentation": documentation,
        }
        if parents is not None:
            body["parents"] = parents
        if children is not None:
            body["children"] = children
        if cloud_resource_types is not None:
            body["cloud_resource_types"] = cloud_resource_types
        if labels is not None:
            body["labels"] = labels
        if configuration is not None:
            body["configuration"] = configuration
        return await mutate_entity_adapter(client, "PATCH", f"templates/{template_id}", auth_context, body)
