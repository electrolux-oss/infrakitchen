from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


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
