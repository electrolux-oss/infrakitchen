from contextvars import ContextVar
from typing import Any

import httpx
from fastmcp import FastMCP

from infrakitchen_mcp.provider import list_entities_adapter


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
