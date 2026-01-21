from pathlib import Path
from fastapi import FastAPI, Request
from infrakitchen_mcp.client import DocsProvider, InternalAPIClient
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware
from fastmcp import FastMCP

from .context import request_auth_token

DEFAULT_DOCS_DIR = Path(__file__).parent.parent.parent.parent / "docs"

MCP_INSTRUCTIONS = """
InfraKitchen manages cloud infrastructure:

ENTITIES:
- workspaces: Isolated environments/projects containing infrastructure configs
- integrations: Cloud provider connections i.e. (AWS/Azure/GCP credentials)
- source_code_versions: Versioned IaC templates (Terraform/opentofu) with configs/outputs/variables
- tasks: Async execution jobs (plan/apply/destroy) that modify infrastructure
- workers: Agents that execute tasks
- storages: State backend configs e.g. (S3, Azure Blob)
- users/permissions: RBAC with roles and policies

DOCUMENTATION:
- Use `search_docs` to find relevant files with more indepth descriptions of the objects
- Read content using the 'read_documentation_file' tool OR the 'docs://{path}' resource.
"""


async def _auth_middleware_dispatch(request: Request, call_next):
    token = request_auth_token.set(request.headers.get("Authorization"))
    try:
        return await call_next(request)
    finally:
        request_auth_token.reset(token)


def setup_mcp_server(fastapi_app: FastAPI, mount_path: str = "/mcp") -> Starlette:
    """Create and mount an MCP server onto the FastAPI application."""
    from .tools import register_tools

    mcp_server = FastMCP("InfraKitchen", instructions=MCP_INSTRUCTIONS)
    api_client = InternalAPIClient(fastapi_app)
    docs_provider = DocsProvider(base_dir=DEFAULT_DOCS_DIR)

    register_tools(mcp_server, api_client, docs_provider)

    mcp_http_app = mcp_server.http_app(path="/")
    mcp_http_app.add_middleware(BaseHTTPMiddleware, dispatch=_auth_middleware_dispatch)
    fastapi_app.mount(mount_path, mcp_http_app)

    return mcp_http_app
