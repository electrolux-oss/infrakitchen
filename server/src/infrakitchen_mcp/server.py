from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.docs_tools import register_docs
from infrakitchen_mcp.transforms import CompressResultsTransform
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware

from fastmcp import FastMCP

from .provider import GroupedMCPProvider
from .registry import registry
from .context import request_auth_token

DEFAULT_DOCS_DIR = Path(__file__).parent.parent.parent.parent / "docs"

MCP_INSTRUCTIONS = """
InfraKitchen manages cloud infrastructure.
"""


async def _auth_middleware_dispatch(request: Request, call_next):
    """Forward auth headers from MCP transport to internal API calls."""
    token = request_auth_token.set(request.headers.get("Authorization"))
    try:
        return await call_next(request)
    finally:
        request_auth_token.reset(token)


def setup_mcp_server(fastapi_app: FastAPI, mount_path: str = "/api/mcp") -> Starlette:
    # ASGITransport doesn't hold real resources - no cleanup needed
    internal_client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=fastapi_app),
        base_url="http://internal",
    )

    get_one_provider = GroupedMCPProvider(
        group=get_one_group,
        app=fastapi_app,
        client=internal_client,
        registry=registry,
        auth_context=request_auth_token,
    )

    list_provider = GroupedMCPProvider(
        group=list_entities_group,
        app=fastapi_app,
        client=internal_client,
        registry=registry,
        auth_context=request_auth_token,
    )
    list_provider.add_transform(CompressResultsTransform())

    mcp_server = FastMCP(
        "InfraKitchen",
        instructions=MCP_INSTRUCTIONS,
        providers=[get_one_provider, list_provider],
    )

    register_docs(mcp_server, DEFAULT_DOCS_DIR)

    mcp_http_app = mcp_server.http_app(path="/")
    mcp_http_app.add_middleware(BaseHTTPMiddleware, dispatch=_auth_middleware_dispatch)
    fastapi_app.mount(mount_path, mcp_http_app)

    return mcp_http_app
