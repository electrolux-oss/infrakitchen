from typing import get_args
import re
from fastapi.routing import APIRoute
from infrakitchen_mcp.client import InternalAPIClient
import pytest
from fastapi import FastAPI

from infrakitchen_mcp.tools import EntityType
from infrakitchen_mcp.context import request_auth_token


class TestInternalAPIClient:
    @pytest.mark.asyncio
    async def test_get_list(self, fastapi_app):
        client = InternalAPIClient(fastapi_app)

        token = request_auth_token.set("Bearer test")
        try:
            result = await client.get("workspaces")
            assert isinstance(result, list)
            assert len(result) > 0
            assert result[0]["id"] == "ws-1"
        finally:
            request_auth_token.reset(token)

    @pytest.mark.asyncio
    async def test_get_single(self, fastapi_app):
        client = InternalAPIClient(fastapi_app)
        result = await client.get("workspaces/ws-1")
        assert result["id"] == "ws-1"

    @pytest.mark.asyncio
    async def test_not_found(self, fastapi_app):
        client = InternalAPIClient(fastapi_app)
        result = await client.get("nonexistent")
        assert result["error"] == "not_found"


def get_api_routes(app: FastAPI) -> set[str]:
    """Extract all API route patterns from FastAPI app."""
    routes = set()
    for route in app.routes:
        if isinstance(route, APIRoute) and hasattr(route, "path") and route.path.startswith("/api/"):
            path = route.path.removeprefix("/api/")
            normalized = re.sub(r"\{[^}]+\}", "{*}", path)
            routes.add(normalized)
    return routes


@pytest.fixture
def api_routes(real_fastapi_app: FastAPI) -> set[str]:
    """Get routes from the actual FastAPI app."""
    return get_api_routes(real_fastapi_app)


class TestEntityTypesMatchEndpoints:
    """Verify each EntityType has corresponding API endpoints."""

    @pytest.mark.parametrize("entity", get_args(EntityType))
    def test_entity_list_endpoint_exists(self, api_routes: set[str], entity: str):
        """
        Each entity type must have a list endpoint.
        Used by: list_entities(entity=...)
        """
        assert entity in api_routes, f"No list endpoint for entity '{entity}'. Expected route: /api/{entity}"

    @pytest.mark.parametrize("entity", get_args(EntityType))
    def test_entity_detail_endpoint_exists(self, api_routes: set[str], entity: str):
        """
        Each entity type must have a detail endpoint.
        Used by: read_entity(entity=...)
        """
        expected = f"{entity}/{{*}}"
        assert expected in api_routes, f"No detail endpoint for entity '{entity}'. Expected route: /api/{entity}/{{id}}"


class TestSourceCodeMetaEndpoints:
    """Verify source_code_versions sub-resources exist matching the specific tools."""

    @pytest.mark.parametrize("meta_type", ["configs", "outputs"])
    def test_version_meta_endpoint_exists(self, api_routes: set[str], meta_type: str):
        """
        Verify endpoints used by 'get_version_metadata'.
        Valid types: 'configs', 'outputs'.
        """
        expected = f"source_code_versions/{{*}}/{meta_type}"
        assert expected in api_routes, (
            f"No endpoint for meta type '{meta_type}'. "
            f"Expected route: /api/source_code_versions/{{version_id}}/{meta_type}"
        )

    @pytest.mark.parametrize("meta_type", ["outputs", "references"])
    def test_template_meta_endpoint_exists(self, api_routes: set[str], meta_type: str):
        """
        Verify endpoints used by 'get_template_metadata'.
        Valid types: 'outputs', 'references'.
        """
        expected = f"source_code_versions/template/{{*}}/{meta_type}"
        assert expected in api_routes, (
            f"No template endpoint for meta type '{meta_type}'. "
            f"Expected route: /api/source_code_versions/template/{{template_id}}/{meta_type}"
        )

    def test_specific_config_endpoint_exists(self, api_routes: set[str]):
        """
        Verify endpoint used by 'get_version_config'.
        """
        expected = "source_code_versions/{*}/configs/{*}"
        assert expected in api_routes, (
            "No endpoint for specific config. "
            "Expected route: /api/source_code_versions/{version_id}/configs/{config_id}"
        )


class TestOtherToolEndpoints:
    """Verify other hardcoded tool endpoints exist."""

    def test_integration_validate_endpoint(self, api_routes: set[str]):
        """validate_integration tool endpoint should exist."""
        assert "integrations/{*}/validate" in api_routes

    def test_revisions_endpoint(self, api_routes: set[str]):
        """revisions tool endpoint should exist."""
        assert "revisions/{*}" in api_routes

    @pytest.mark.parametrize(
        "path",
        [
            "permissions/roles",
            "permissions/user/{*}/roles",
            "permissions/role/{*}/api/policies",
            "permissions/{*}/{*}/policies",
            "user/policies",
        ],
    )
    def test_permission_endpoints(self, api_routes: set[str], path: str):
        """All permission scope endpoints should exist."""
        assert path in api_routes, f"Missing permission endpoint: /api/{path}"

    @pytest.mark.parametrize(
        "path",
        [
            "constants",
            "configs/auth_providers",
            "scheduler/jobs",
            "labels",
        ],
    )
    def test_system_endpoints(self, api_routes: set[str], path: str):
        """All system info endpoints should exist."""
        assert path in api_routes, f"Missing system endpoint: /api/{path}"
