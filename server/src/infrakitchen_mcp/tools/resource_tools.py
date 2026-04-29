from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_resource_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing resources."""

    @mcp.tool(
        description=(
            "List infrastructure resources with optional filtering and pagination.\n\n"
            "Resources are concrete infrastructure instances provisioned from templates "
            "(e.g., a specific AWS EC2 instance, a Kubernetes namespace). "
            "Each resource tracks its provisioning state, status, variables, outputs, "
            "and relationships to other resources.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), description (string), "
            "template (TemplateShort — id, name, cloud_resource_types), "
            "state ('provision'|'provisioned'|'destroy'|'destroyed'), "
            "status ('queued'|'in_progress'|'done'|'error'|'unknown'|"
            "'approval_pending'|'pending'|'rejected'|'ready'), "
            "abstract (bool), revision_number (int), "
            "creator (UserShort), labels (list[str]), "
            "workspace (WorkspaceShort|null), workspace_id (UUID|null), "
            "source_code_version (SourceCodeVersionShort|null), "
            "source_code_version_id (UUID|null), "
            "integration_ids (list[IntegrationShort]), "
            "secret_ids (list[SecretShort]), "
            "storage (StorageShort|null), storage_path (string|null), "
            "variables (list[Variables]), outputs (list[Outputs]), "
            "dependency_tags (list[DependencyTag]), "
            "dependency_config (list[DependencyConfig]), "
            "parents (list[ResourceShort]), children (list[ResourceShort]), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in, contains_all, any.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID string).\n"
            '    Example: {"id": "550e8400-e29b-41d4-a716-446655440000"}\n'
            "  - name: exact match or partial match with 'like'.\n"
            '    Example: {"name": "my-ec2-instance"}\n'
            '    Example: {"name__like": "ec2"} — case-insensitive substring match.\n'
            "  - description: partial match with 'like'.\n"
            '    Example: {"description__like": "production"}\n'
            "  - status: exact match.\n"
            "    Values: 'queued', 'in_progress', 'done', 'error', 'unknown', "
            "'approval_pending', 'pending', 'rejected', 'ready'.\n"
            '    Example: {"status": "done"}\n'
            "  - state: exact match.\n"
            "    Values: 'provision', 'provisioned', 'destroy', 'destroyed'.\n"
            '    Example: {"state": "provisioned"}\n'
            "  - abstract: exact match (boolean).\n"
            '    Example: {"abstract": false}\n'
            "  - template_id: exact match (UUID of the template).\n"
            '    Example: {"template_id": "<template-uuid>"}\n'
            "  - workspace_id: exact match (UUID of the workspace).\n"
            '    Example: {"workspace_id": "<workspace-uuid>"}\n'
            "  - source_code_version_id: exact match (UUID).\n"
            '    Example: {"source_code_version_id": "<scv-uuid>"}\n'
            "  - storage_id: exact match (UUID).\n"
            '    Example: {"storage_id": "<storage-uuid>"}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            "    Matches resources that have ALL specified labels.\n"
            '    Example: {"labels__contains_all": ["aws", "production"]}\n'
            "  - integration_ids: use 'any' — list of integration UUIDs.\n"
            '    Example: {"integration_ids__any": ["<integration-uuid>"]}\n'
            "  - secret_ids: use 'any' — list of secret UUIDs.\n"
            '    Example: {"secret_ids__any": ["<secret-uuid>"]}\n'
            "  - children / parents: use 'any' — list of resource UUIDs.\n"
            '    Example: {"children__any": ["<child-resource-uuid>"]}\n'
            "  - template (relationship): filter by template fields using "
            "'template__<field>__<operator>'.\n"
            '    Example: {"template__name__like": "ec2"}\n'
            '    Example: {"template__name__in": ["template_a", "template_b"]}\n'
            "  - workspace (relationship): filter by workspace fields.\n"
            '    Example: {"workspace__name__like": "prod"}\n\n'
            "Multiple filters can be combined in one object:\n"
            '  {"state": "provisioned", "labels__contains_all": ["aws"], '
            '"template__name__like": "ec2"}\n\n'
            "DO NOT use unsupported operators for a field (e.g., 'contains_all' on 'name').\n"
            "Pass null/None to skip filtering and return all resources.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Example: [0, 9] returns the first 10 resources.\n"
            "- Example: [10, 19] returns the next 10.\n"
            "- Default is [0, 5] (first 6 resources).\n"
            "- To get more results, increase the end index.\n\n"
            "RESPONSE:\n"
            "- Returns a list of resource objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='resources' and the resource id "
            "to retrieve full details of a specific resource."
        ),
    )
    async def list_resources(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List infrastructure resources with optional filtering and pagination."""
        return await list_entities_adapter(client, "resources", auth_context, filter, range)
