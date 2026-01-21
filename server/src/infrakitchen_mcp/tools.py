import json
from typing import Any, Literal
from fastmcp import FastMCP
from infrakitchen_mcp.client import DocsProvider, InternalAPIClient

EntityType = Literal[
    "workspaces", "integrations", "users", "workers", "tasks", "source_code_versions", "storages", "logs", "audit_logs"
]


def register_tools(mcp: FastMCP, api: InternalAPIClient, docs: DocsProvider) -> None:
    """Register all MCP tools and resources."""

    @mcp.tool()
    async def read_entity(entity: EntityType, id: str) -> Any:
        """Get a specific entity by its ID."""
        return await api.get(f"{entity}/{id}")

    @mcp.tool()
    async def list_entities(
        entity: EntityType,
        filter: dict[str, Any] | None = None,
        offset: int = 0,
        limit: int = 10,
    ) -> Any:
        """
        List entities with optional filtering and pagination.

        Args:
            filter: Dictionary of filter fields (e.g. {"status": "active"})
            offset: Starting index (default 0)
            limit: Number of items to return (default 10)
        """
        range_val = [offset, offset + limit]
        query_params = {"range": json.dumps(range_val)}
        if filter:
            query_params["filter"] = json.dumps(filter)

        return await api.get(entity, **query_params)

    @mcp.tool()
    async def get_template_metadata(template_id: str, meta_type: Literal["outputs", "references"]) -> Any:
        """
        Get metadata for a source code template.

        Args:
            template_id: The UUID of the template
            meta_type: Type of metadata to retrieve ('outputs' or 'references')
        """
        return await api.get(f"source_code_versions/template/{template_id}/{meta_type}")

    @mcp.tool()
    async def get_version_metadata(version_id: str, meta_type: Literal["configs", "outputs"]) -> Any:
        """
        Get metadata for a specific source code version.

        Args:
            version_id: The ID of the source code version
            meta_type: Type of metadata to retrieve ('configs' or 'outputs')
        """
        return await api.get(f"source_code_versions/{version_id}/{meta_type}")

    @mcp.tool()
    async def get_version_config(version_id: str, config_id: str) -> Any:
        """
        Get details of a specific configuration item within a source code version.
        """
        return await api.get(f"source_code_versions/{version_id}/configs/{config_id}")

    @mcp.tool()
    async def actions(entity: EntityType, id: str | None = None) -> list[str]:
        """Get available actions for an entity type or specific entity."""
        path = f"{entity}/{id}/actions" if id else f"{entity}/actions"
        return await api.get(path)

    @mcp.tool()
    async def validate_integration(integration_id: str) -> Any:
        """Validate a cloud provider integration."""
        return await api.get(f"integrations/{integration_id}/validate")

    @mcp.tool()
    async def revisions(entity_id: str, revision: int | None = None) -> Any:
        """Get revision history for an entity."""
        path = f"revisions/{entity_id}"
        if revision is not None:
            path += f"/{revision}"
        return await api.get(path)

    @mcp.tool()
    async def permissions(
        scope: Literal["roles", "user_roles", "role_policies", "entity_policies", "my_policies"],
        id: str | None = None,
        entity_id: str | None = None,
    ) -> Any:
        """Query permission information."""
        paths = {
            "roles": "permissions/roles",
            "user_roles": f"permissions/user/{id}/roles",
            "role_policies": f"permissions/role/{id}/api/policies",
            "entity_policies": f"permissions/{id}/{entity_id}/policies",
            "my_policies": "user/policies",
        }
        return await api.get(paths[scope])

    @mcp.tool()
    async def system(info: Literal["constants", "auth_providers", "scheduled_jobs", "labels"]) -> Any:
        """Get system configuration information."""
        paths = {
            "constants": "constants",
            "auth_providers": "configs/auth_providers",
            "scheduled_jobs": "scheduler/jobs",
            "labels": "labels",
        }
        return await api.get(paths[info])

    @mcp.resource("docs://index")
    def docs_index() -> str:
        """List all available documentation files."""
        files = docs.list_files()
        return "Available Documentation:\n" + "\n".join(f"- docs://{f}" for f in files)

    @mcp.resource("docs://{file_path}")
    def docs_resource(file_path: str) -> str:
        """Read documentation file via resource URI."""
        try:
            return docs.read_file(file_path)
        except Exception as e:
            return f"Error: {e}"

    @mcp.tool()
    def search_docs(query: str | None = None) -> list[str]:
        """Search documentation files by name. Returns paths for use with read_documentation_file."""
        return docs.list_files(query)

    @mcp.tool()
    def read_documentation_file(file_path: str) -> str:
        """Read a documentation file's content."""
        try:
            return docs.read_file(file_path)
        except Exception as e:
            return f"Error: {e}"
