from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter, mutate_entity_adapter


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

    @mcp.tool(
        description=(
            "Create a new infrastructure resource from a template.\n\n"
            "A resource is a concrete infrastructure instance provisioned from a template. "
            "It holds variables, integrations, storage config, and parent/child relationships.\n\n"
            "REQUIRED FIELDS:\n"
            "  - name (string): Resource name. Supports pattern placeholders "
            "like 'my-resource-{env}'. Must match [a-zA-Z0-9_-] outside placeholders.\n"
            "  - template_id (string): UUID of the template to create from. "
            "Immutable after creation.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - description (string): Human-readable description. Default: ''.\n"
            "  - source_code_version_id (string|null): UUID of the source code version "
            "that defines variables/outputs for this resource. Default: null.\n"
            "  - integration_ids (list[string]): UUIDs of integrations "
            "(e.g., AWS credentials) to attach. Default: [].\n"
            "  - secret_ids (list[string]): UUIDs of secrets to attach. Default: [].\n"
            "  - storage_id (string|null): UUID of the storage backend for state. "
            "Default: null.\n"
            "  - storage_path (string|null): Path within the storage backend. "
            "Supports pattern placeholders. Default: null.\n"
            "  - variables (list[object]): Variable values for the resource. "
            "Each object: {name: str, value: any, sensitive?: bool, type?: str, "
            "description?: str}. Default: [].\n"
            "  - dependency_tags (list[object]): Cloud provider tags. "
            "Each object: {name: str, value: str, inherited_by_children?: bool}. Default: [].\n"
            "  - dependency_config (list[object]): Shared configs for children. "
            "Each object: {name: str, value: str, inherited_by_children?: bool}. Default: [].\n"
            "  - parents (list[string]): UUIDs of parent resources. Default: [].\n"
            "  - children (list[string]): UUIDs of child resources. Default: [].\n"
            "  - labels (list[string]): Freeform labels. Default: [].\n"
            "  - workspace_id (string|null): UUID of the workspace. Default: null.\n\n"
            "EXAMPLE:\n"
            '  {"name": "prod-vpc", "template_id": "<uuid>", '
            '"source_code_version_id": "<uuid>", '
            '"integration_ids": ["<aws-integration-uuid>"], '
            '"variables": [{"name": "region", "value": "eu-west-1"}], '
            '"labels": ["aws", "production"]}\n\n'
            "RESPONSE:\n"
            "  Returns the created resource with all fields including generated id, "
            "state, status, outputs, etc."
        ),
    )
    async def create_resource(
        name: str,
        template_id: str,
        description: str = "",
        source_code_version_id: str | None = None,
        integration_ids: list[str] | None = None,
        secret_ids: list[str] | None = None,
        storage_id: str | None = None,
        storage_path: str | None = None,
        variables: list[dict[str, Any]] | None = None,
        dependency_tags: list[dict[str, Any]] | None = None,
        dependency_config: list[dict[str, Any]] | None = None,
        parents: list[str] | None = None,
        children: list[str] | None = None,
        labels: list[str] | None = None,
        workspace_id: str | None = None,
    ) -> dict[str, Any]:
        """Create a new infrastructure resource."""
        body: dict[str, Any] = {
            "name": name,
            "template_id": template_id,
            "description": description,
        }
        if source_code_version_id is not None:
            body["source_code_version_id"] = source_code_version_id
        if integration_ids is not None:
            body["integration_ids"] = integration_ids
        if secret_ids is not None:
            body["secret_ids"] = secret_ids
        if storage_id is not None:
            body["storage_id"] = storage_id
        if storage_path is not None:
            body["storage_path"] = storage_path
        if variables is not None:
            body["variables"] = variables
        if dependency_tags is not None:
            body["dependency_tags"] = dependency_tags
        if dependency_config is not None:
            body["dependency_config"] = dependency_config
        if parents is not None:
            body["parents"] = parents
        if children is not None:
            body["children"] = children
        if labels is not None:
            body["labels"] = labels
        if workspace_id is not None:
            body["workspace_id"] = workspace_id
        return await mutate_entity_adapter(client, "POST", "resources", auth_context, body)

    @mcp.tool(
        description=(
            "Update an existing infrastructure resource.\n\n"
            "REQUIRED FIELDS:\n"
            "  - resource_id (string): UUID of the resource to update.\n\n"
            "OPTIONAL FIELDS (all default to None — only provided fields are updated):\n"
            "  - name (string|null): Updated resource name.\n"
            "  - description (string|null): Updated description.\n"
            "  - source_code_version_id (string|null): Updated source code version UUID.\n"
            "  - integration_ids (list[string]|null): Updated integration UUIDs.\n"
            "  - secret_ids (list[string]|null): Updated secret UUIDs.\n"
            "  - storage_id (string|null): Updated storage UUID.\n"
            "  - storage_path (string|null): Updated storage path.\n"
            "  - variables (list[object]|null): Updated variables. "
            "Each object: {name: str, value: any, sensitive?: bool, type?: str, "
            "description?: str}.\n"
            "  - dependency_tags (list[object]|null): Updated cloud tags.\n"
            "  - dependency_config (list[object]|null): Updated shared configs.\n"
            "  - labels (list[string]|null): Updated labels.\n"
            "  - workspace_id (string|null): Updated workspace UUID.\n\n"
            "NOTE: template_id cannot be changed after creation.\n"
            "NOTE: At least one field must be provided.\n\n"
            "EXAMPLE:\n"
            '  {"resource_id": "<uuid>", "variables": [{"name": "region", '
            '"value": "us-east-1"}], "labels": ["aws", "staging"]}\n\n'
            "RESPONSE:\n"
            "  Returns the updated resource with all fields."
        ),
    )
    async def update_resource(
        resource_id: str,
        name: str | None = None,
        description: str | None = None,
        source_code_version_id: str | None = None,
        integration_ids: list[str] | None = None,
        secret_ids: list[str] | None = None,
        storage_id: str | None = None,
        storage_path: str | None = None,
        variables: list[dict[str, Any]] | None = None,
        dependency_tags: list[dict[str, Any]] | None = None,
        dependency_config: list[dict[str, Any]] | None = None,
        labels: list[str] | None = None,
        workspace_id: str | None = None,
    ) -> dict[str, Any]:
        """Update an existing infrastructure resource."""
        body: dict[str, Any] = {}
        if name is not None:
            body["name"] = name
        if description is not None:
            body["description"] = description
        if source_code_version_id is not None:
            body["source_code_version_id"] = source_code_version_id
        if integration_ids is not None:
            body["integration_ids"] = integration_ids
        if secret_ids is not None:
            body["secret_ids"] = secret_ids
        if storage_id is not None:
            body["storage_id"] = storage_id
        if storage_path is not None:
            body["storage_path"] = storage_path
        if variables is not None:
            body["variables"] = variables
        if dependency_tags is not None:
            body["dependency_tags"] = dependency_tags
        if dependency_config is not None:
            body["dependency_config"] = dependency_config
        if labels is not None:
            body["labels"] = labels
        if workspace_id is not None:
            body["workspace_id"] = workspace_id
        return await mutate_entity_adapter(
            client, "PATCH", f"resources/{resource_id}", auth_context, body
        )

    @mcp.tool(
        description=(
            "Execute an action on an infrastructure resource.\n\n"
            "REQUIRED FIELDS:\n"
            "  - resource_id (string): UUID of the resource.\n"
            "  - action (string): The action to perform.\n\n"
            "AVAILABLE ACTIONS:\n"
            "  - 'execute': Provision or apply the resource (runs the infrastructure code).\n"
            "  - 'destroy': Tear down the provisioned infrastructure.\n"
            "  - 'dryrun': Preview changes without applying (plan).\n"
            "  - 'retry': Retry a failed execution.\n"
            "  - 'recreate': Destroy and re-provision the resource.\n"
            "  - 'approve': Approve a pending resource change.\n"
            "  - 'reject': Reject a pending resource change.\n"
            "  - 'sync': Sync the resource state with the actual infrastructure.\n"
            "  - 'enable': Re-enable a disabled resource.\n"
            "  - 'disable': Disable the resource.\n\n"
            "NOTE: Available actions depend on the current state/status and user permissions. "
            "If an action is not permitted, the API returns a 403 error with details.\n\n"
            "EXAMPLE:\n"
            '  {"resource_id": "<uuid>", "action": "execute"}\n\n'
            "RESPONSE:\n"
            "  Returns the updated resource after the action is applied."
        ),
    )
    async def action_resource(
        resource_id: str,
        action: str,
    ) -> dict[str, Any]:
        """Execute an action on an infrastructure resource."""
        return await mutate_entity_adapter(
            client, "PATCH", f"resources/{resource_id}/actions", auth_context, {"action": action}
        )
