from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter, mutate_entity_adapter


def register_source_code_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing source codes."""

    @mcp.tool(
        description=(
            "List source code repositories with optional filtering and pagination.\n\n"
            "Source codes represent Git repositories connected to InfraKitchen. "
            "They track branches, tags, and folders available for creating "
            "source code versions.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), source_code_url (string — Git repository URL), "
            "source_code_provider ('github'|'gitlab'|'bitbucket'|'azure_devops'|"
            "'git_public'), "
            "source_code_language ('opentofu'), "
            "description (string), labels (list[str]), "
            "integration (IntegrationShort|null), "
            "git_tags (list[str]), git_branches (list[str]), "
            "git_tag_messages (dict|null), git_branch_messages (dict|null), "
            "git_folders_map (list[RefFolders]), "
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
            "  - source_code_url: exact match or 'like'.\n"
            '    Example: {"source_code_url__like": "github.com/myorg"}\n'
            "  - source_code_provider: exact match.\n"
            "    Values: 'github', 'gitlab', 'bitbucket', 'azure_devops', "
            "'git_public'.\n"
            '    Example: {"source_code_provider": "github"}\n'
            "  - source_code_language: exact match.\n"
            '    Example: {"source_code_language": "opentofu"}\n'
            "  - status: exact match.\n"
            "    Values: 'in_progress', 'done', 'error', 'ready', 'disabled'.\n"
            '    Example: {"status": "ready"}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            '    Example: {"labels__contains_all": ["aws"]}\n'
            "  - integration (relationship): filter by integration fields.\n"
            '    Example: {"integration__name__like": "github"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"source_code_provider": "github", "status": "ready"}\n\n'
            "Pass null/None to skip filtering and return all source codes.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of source code objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='source_codes' and the id "
            "to retrieve full details."
        ),
    )
    async def list_source_codes(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List source code repositories with optional filtering and pagination."""
        return await list_entities_adapter(client, "source_codes", auth_context, filter, range)

    @mcp.tool(
        description=(
            "Create a new source code repository connection.\n\n"
            "REQUIRED FIELDS:\n"
            "  - source_code_url (string): Git repository URL "
            "(e.g., 'https://github.com/org/repo'). Immutable after creation.\n"
            "  - source_code_provider (string): Git provider. Immutable after creation.\n"
            "    Values: 'github', 'gitlab', 'bitbucket', 'azure_devops', 'git_public'.\n"
            "  - source_code_language (string): Infrastructure language. Immutable after creation.\n"
            "    Values: 'opentofu'.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - description (string): Human-readable description. Default: ''.\n"
            "  - integration_id (string|null): UUID of the integration to use for "
            "accessing the repository (e.g., a GitHub integration with credentials). "
            "Default: null.\n"
            "  - labels (list[string]): Freeform labels for categorization. Default: [].\n\n"
            "EXAMPLE:\n"
            '  {"source_code_url": "https://github.com/org/infra-modules", '
            '"source_code_provider": "github", "source_code_language": "opentofu", '
            '"integration_id": "<uuid>", "labels": ["aws", "modules"]}\n\n'
            "RESPONSE:\n"
            "  Returns the created source code object with all fields including "
            "generated id, status, git_branches, git_tags, etc."
        ),
    )
    async def create_source_code(
        source_code_url: str,
        source_code_provider: str,
        source_code_language: str,
        description: str = "",
        integration_id: str | None = None,
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        """Create a new source code repository connection."""
        body: dict[str, Any] = {
            "source_code_url": source_code_url,
            "source_code_provider": source_code_provider,
            "source_code_language": source_code_language,
            "description": description,
        }
        if integration_id is not None:
            body["integration_id"] = integration_id
        if labels is not None:
            body["labels"] = labels
        return await mutate_entity_adapter(client, "POST", "source_codes", auth_context, body)

    @mcp.tool(
        description=(
            "Update an existing source code repository.\n\n"
            "REQUIRED FIELDS:\n"
            "  - source_code_id (string): UUID of the source code to update.\n\n"
            "OPTIONAL FIELDS:\n"
            "  - description (string|null): Updated description. Default: null (no change).\n"
            "  - integration_id (string|null): Updated integration UUID. Default: null.\n"
            "  - labels (list[string]): Updated labels. Default: [].\n\n"
            "NOTE: source_code_url, source_code_provider, and source_code_language "
            "are immutable and cannot be changed after creation.\n\n"
            "EXAMPLE:\n"
            '  {"source_code_id": "<uuid>", "description": "Updated modules repo", '
            '"labels": ["aws", "production"]}\n\n'
            "RESPONSE:\n"
            "  Returns the updated source code object with all fields."
        ),
    )
    async def update_source_code(
        source_code_id: str,
        description: str | None = None,
        integration_id: str | None = None,
        labels: list[str] | None = None,
    ) -> dict[str, Any]:
        """Update an existing source code repository."""
        body: dict[str, Any] = {}
        if description is not None:
            body["description"] = description
        if integration_id is not None:
            body["integration_id"] = integration_id
        if labels is not None:
            body["labels"] = labels
        return await mutate_entity_adapter(client, "PATCH", f"source_codes/{source_code_id}", auth_context, body)

    @mcp.tool(
        description=(
            "Execute an action on a source code repository (e.g., sync, enable, disable).\n\n"
            "REQUIRED FIELDS:\n"
            "  - source_code_id (string): UUID of the source code.\n"
            "  - action (string): The action to perform.\n\n"
            "AVAILABLE ACTIONS:\n"
            "  - 'sync': Synchronize branches, tags, and folders from the Git remote.\n"
            "  - 'enable': Re-enable a disabled source code.\n"
            "  - 'disable': Disable the source code (prevents new versions from being created).\n\n"
            "NOTE: Available actions depend on the current state of the source code "
            "and user permissions. If an action is not permitted, the API returns a "
            "403 error with details.\n\n"
            "EXAMPLE:\n"
            '  {"source_code_id": "<uuid>", "action": "sync"}\n\n'
            "RESPONSE:\n"
            "  Returns the updated source code object after the action is applied."
        ),
    )
    async def action_source_code(
        source_code_id: str,
        action: str,
    ) -> dict[str, Any]:
        """Execute an action on a source code repository."""
        return await mutate_entity_adapter(
            client, "PATCH", f"source_codes/{source_code_id}/actions", auth_context, {"action": action}
        )
