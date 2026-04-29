from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


def register_workspace_tools(
    mcp: FastMCP,
    client: httpx.AsyncClient,
    auth_context: ContextVar[str | None] | None = None,
) -> None:
    """Register a dedicated MCP tool for listing workspaces."""

    @mcp.tool(
        description=(
            "List workspaces with optional filtering and pagination.\n\n"
            "Workspaces represent Git repositories imported from a Git provider "
            "(GitHub, Bitbucket, Azure DevOps). They store repository metadata "
            "and are linked to an integration for authentication.\n\n"
            "RESPONSE FIELDS:\n"
            "  id (UUID), name (string), description (string), "
            "workspace_provider ('github'|'bitbucket'|'azure_devops'), "
            "integration (IntegrationShort), "
            "labels (list[str]), "
            "status ('in_progress'|'done'|'error'), "
            "configuration (WorkspaceMeta — name, url, ssh_url, https_url, "
            "default_branch, organization), "
            "creator (UserShort), "
            "created_at (datetime), updated_at (datetime).\n\n"
            "FILTERING:\n"
            "The 'filter' parameter is a JSON object. Keys use the format "
            "'<field>' for equality or '<field>__<operator>' for other operators.\n\n"
            "Supported operators: eq (default), like, in, contains_all.\n\n"
            "Filterable fields and their operators:\n"
            "  - id: exact match (UUID).\n"
            '    Example: {"id": "<uuid>"}\n'
            "  - name: exact match or 'like'.\n"
            '    Example: {"name__like": "my-repo"}\n'
            "  - workspace_provider: exact match.\n"
            "    Values: 'github', 'bitbucket', 'azure_devops'.\n"
            '    Example: {"workspace_provider": "github"}\n'
            "  - status: exact match.\n"
            "    Values: 'in_progress', 'done', 'error'.\n"
            '    Example: {"status": "done"}\n'
            "  - labels: use 'contains_all' — value MUST be a list of strings.\n"
            '    Example: {"labels__contains_all": ["production"]}\n'
            "  - integration (relationship): filter by integration fields.\n"
            '    Example: {"integration__name__like": "github"}\n\n'
            "Multiple filters can be combined:\n"
            '  {"workspace_provider": "github", "status": "done"}\n\n'
            "Pass null/None to skip filtering and return all workspaces.\n\n"
            "PAGINATION:\n"
            "- Use the 'range' parameter as a two-element array [start, end] "
            "(0-based, inclusive on both sides).\n"
            "- Default is [0, 5] (first 6 entries).\n\n"
            "RESPONSE:\n"
            "- Returns a list of workspace objects with summarized nested fields.\n"
            "- Use get_entity with entity_type='workspaces' and the id "
            "to retrieve full details."
        ),
    )
    async def list_workspaces(
        filter: dict[str, Any] | None = None,
        range: tuple[int, int] = (0, 5),
    ) -> dict[str, Any]:
        """List workspaces with optional filtering and pagination."""
        return await list_entities_adapter(client, "workspaces", auth_context, filter, range)
