from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter, mutate_entity_adapter


def register_source_code_version_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing source code versions."""

    @mcp.tool(
        description=(
            "List source code versions with optional filtering and pagination.\n\n"
            "Source code versions link a specific Git ref (tag or branch) and folder "
            "from a source code repository to a template. They define the variables "
            "and outputs available for infrastructure provisioning.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), template (TemplateShort), source_code (SourceCodeShort), "
            "source_code_version (string|null — Git tag), "
            "source_code_branch (string|null — Git branch), "
            "source_code_folder (string — subfolder path), "
            "variables (list[VariableModel]), outputs (list[OutputVariableModel]), "
            "description (string), labels (list[str]), "
            "resource_count (int), "
            "status ('in_progress'|'done'|'error'|'ready'|'disabled'), "
            "revision_number (int), creator (UserShort), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in, contains_all.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - template_id: exact match (UUID of the template).\n"
            '    Example: {"template_id": "<template-uuid>"}\n'
            "  - source_code_id: exact match (UUID of the source code).\n"
            '    Example: {"source_code_id": "<source-code-uuid>"}\n'
            "  - source_code_version: exact match or 'like' (Git tag).\n"
            '    Example: {"source_code_version": "v1.0.0"}\n'
            '    Example: {"source_code_version__like": "v1"}\n'
            "  - source_code_branch: exact match or 'like' (Git branch).\n"
            '    Example: {"source_code_branch": "main"}\n'
            "  - source_code_folder: exact match or 'like'.\n"
            '    Example: {"source_code_folder__like": "modules"}\n'
            "  - status: exact match.\n"
            "    Values: 'in_progress', 'done', 'error', 'ready', 'disabled'.\n"
            '    Example: {"status": "ready"}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            '    Example: {"labels__contains_all": ["aws"]}\n'
            "  - template (relationship): filter by template fields.\n"
            '    Example: {"template__name__like": "ec2"}\n'
            "  - source_code (relationship): filter by source code fields.\n"
            '    Example: {"source_code__source_code_url__like": "github.com"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"template_id": "<uuid>", "status": "ready"}\n\n'
            "Pass null/None to skip filtering and return all source code versions.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of source code version objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='source_code_versions' and the id "
            "to retrieve full details."
        ),
    )
    async def list_source_code_versions(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List source code versions with optional filtering and pagination."""
        return await list_entities_adapter(client, "source_code_versions", auth_context, filter, range)

    @mcp.tool(
        description=(
            "Create a new source code version linking a Git ref to a template.\n\n"
            "A source code version pins a specific Git tag or branch (and optional subfolder) "
            "from a source code repository to a template. After creation the system parses "
            "the infrastructure code to extract variables and outputs.\n\n"
            "REQUIRED FIELDS:\n"
            "  - template_id (string): UUID of the template this version belongs to. "
            "Immutable after creation.\n"
            "  - source_code_id (string): UUID of the source code repository. "
            "Immutable after creation.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - source_code_version (string|null): Git tag to pin "
            "(e.g., 'v1.0.0'). Immutable. Provide either this or source_code_branch.\n"
            "  - source_code_branch (string|null): Git branch to track "
            "(e.g., 'main'). Immutable. Provide either this or source_code_version.\n"
            "  - source_code_folder (string): Subfolder within the repository "
            "(e.g., 'modules/vpc'). Default: '' (root). Immutable.\n"
            "  - description (string): Human-readable description. Default: ''.\n"
            "  - labels (list[string]): Freeform labels. Default: [].\n\n"
            "EXAMPLE:\n"
            '  {"template_id": "<uuid>", "source_code_id": "<uuid>", '
            '"source_code_branch": "main", "source_code_folder": "modules/vpc", '
            '"labels": ["aws", "networking"]}\n\n'
            "RESPONSE:\n"
            "  Returns the created source code version with all fields including "
            "parsed variables and outputs."
        ),
    )
    async def create_source_code_version(
        template_id: str,
        source_code_id: str,
        source_code_version: str | None = None,
        source_code_branch: str | None = None,
        source_code_folder: str = "",
        description: str = "",
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a new source code version."""
        body: dict[str, Any] = {
            "template_id": template_id,
            "source_code_id": source_code_id,
            "source_code_folder": source_code_folder,
            "description": description,
        }
        if source_code_version is not None:
            body["source_code_version"] = source_code_version
        if source_code_branch is not None:
            body["source_code_branch"] = source_code_branch
        if labels is not None:
            body["labels"] = labels
        return await mutate_entity_adapter(client, "POST", "source_code_versions", auth_context, body)

    @mcp.tool(
        description=(
            "Update an existing source code version.\n\n"
            "REQUIRED FIELDS:\n"
            "  - source_code_version_id (string): UUID of the source code version to update.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - description (string): Updated description. Default: ''.\n"
            "  - labels (list[string]): Updated labels. Default: [].\n\n"
            "NOTE: template_id, source_code_id, source_code_version, source_code_branch, "
            "and source_code_folder are all immutable and cannot be changed after creation.\n\n"
            "EXAMPLE:\n"
            '  {"source_code_version_id": "<uuid>", "description": "VPC module v2", '
            '"labels": ["aws", "networking", "v2"]}\n\n'
            "RESPONSE:\n"
            "  Returns the updated source code version with all fields."
        ),
    )
    async def update_source_code_version(
        source_code_version_id: str,
        description: str = "",
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        """Update an existing source code version."""
        body: dict[str, Any] = {"description": description}
        if labels is not None:
            body["labels"] = labels
        return await mutate_entity_adapter(
            client, "PATCH", f"source_code_versions/{source_code_version_id}", auth_context, body
        )

    @mcp.tool(
        description=(
            "Execute an action on a source code version (e.g., sync, enable, disable).\n\n"
            "REQUIRED FIELDS:\n"
            "  - source_code_version_id (string): UUID of the source code version.\n"
            "  - action (string): The action to perform.\n\n"
            "AVAILABLE ACTIONS:\n"
            "  - 'sync': Re-parse variables and outputs from the Git ref.\n"
            "  - 'enable': Re-enable a disabled source code version.\n"
            "  - 'disable': Disable the source code version.\n\n"
            "NOTE: Available actions depend on the current state and user permissions. "
            "If an action is not permitted, the API returns a 403 error with details.\n\n"
            "EXAMPLE:\n"
            '  {"source_code_version_id": "<uuid>", "action": "sync"}\n\n'
            "RESPONSE:\n"
            "  Returns the updated source code version after the action is applied."
        ),
    )
    async def action_source_code_version(
        source_code_version_id: str,
        action: str,
    ) -> dict[str, Any]:
        """Execute an action on a source code version."""
        return await mutate_entity_adapter(
            client,
            "PATCH",
            f"source_code_versions/{source_code_version_id}/actions",
            auth_context,
            {"action": action},
        )
