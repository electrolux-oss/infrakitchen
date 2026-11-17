from pathlib import Path

import httpx
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from mcp_server.docs_tools import register_docs
from mcp_server.graphql_tools import register_graphql_tools
from mcp_server.rest_tools import register_rest_write_tools
from starlette.applications import Starlette
from starlette.middleware.base import BaseHTTPMiddleware

from fastmcp import FastMCP

from core.config import InfrakitchenConfig, Settings
from graphql_api.schema import schema as graphql_schema

from .context import request_auth_token
from .oauth_consent import set_oauth_provider
from .oauth_provider import InfraKitchenOAuthProvider

DEFAULT_DOCS_DIR = Path(__file__).parent.parent.parent.parent / "docs"
AUTH_PROBE_PATH = "/api/auth/me"

MCP_INSTRUCTIONS = """
InfraKitchen manages cloud infrastructure. Use `list_schema_types` and
`get_schema` to discover the GraphQL API, then `graphql_query` to read data.
Use `list_docs` and `read_doc` for narrative documentation.

To stage infrastructure changes, use `create_resource` and `patch_resource`.
Resources are gated by the approval flow: new resources land in
`approval_pending` and wait for a human to approve before any cloud
provisioning happens.

Other write tools (`create_template`, `patch_template`, `create_source_code`,
etc.) take effect immediately — there is no approval gate for these entities.
Use caution when creating or modifying templates, source codes, and storages.

For entities that support lifecycle actions, discover allowed actions first via
their GraphQL `*Actions` query (for example `resourceActions`,
`templateActions`, `sourceCodeActions`, `sourceCodeVersionActions`,
`storageActions`, `integrationActions`, `executorActions`). The corresponding
GraphQL `*Action` mutations exist in the API, and MCP exposes matching
`patch_action_*` tools for supported entities.

Use lifecycle action tools carefully: they can trigger immediate state changes
such as approve, reject, destroy, recreate, or disable when those actions are
allowed for the current entity.
"""


def _auth_middleware_factory(client: httpx.AsyncClient):
    """Build a Starlette middleware that verifies the bearer token before any MCP work.

    Validation happens by probing /api/auth/me through the in-process loopback client,
    which reuses the same JWT verification path as the REST API.  Verified tokens are
    forwarded to MCP tools via the request_auth_token ContextVar.

    This is necessary because some MCP tools (e.g. docs) never hit an internal API
    endpoint and would otherwise be accessible with a bogus token.
    """

    async def _dispatch(request: Request, call_next):
        if InfrakitchenConfig().mcp is False:
            return JSONResponse({"detail": "Not Found"}, status_code=404)

        auth_header = request.headers.get("Authorization")
        if not auth_header:
            return JSONResponse({"detail": "Missing Authorization header"}, status_code=401)

        # Validate the token by probing the auth endpoint through the loopback client.
        try:
            probe = await client.get(AUTH_PROBE_PATH, headers={"Authorization": auth_header})
        except Exception:
            return JSONResponse({"detail": "Auth service unavailable"}, status_code=503)

        if probe.status_code in (401, 403):
            return JSONResponse({"detail": "Invalid or expired token"}, status_code=401)
        if not (200 <= probe.status_code < 300):
            return JSONResponse({"detail": "Auth service error"}, status_code=503)

        token = request_auth_token.set(auth_header)
        try:
            return await call_next(request)
        finally:
            request_auth_token.reset(token)

    return _dispatch


def _feature_flag_middleware():
    async def _dispatch(request: Request, call_next):
        if InfrakitchenConfig().mcp is False:
            return JSONResponse({"detail": "Not Found"}, status_code=404)
        return await call_next(request)

    return _dispatch


def setup_mcp_server(fastapi_app: FastAPI, mount_path: str = "/api/mcp") -> Starlette:
    # ASGITransport doesn't hold real resources - no cleanup needed
    internal_client = httpx.AsyncClient(
        transport=httpx.ASGITransport(app=fastapi_app),
        base_url="http://internal",
    )

    public_url = Settings().INFRAKITCHEN_URL.rstrip("/")
    oauth_provider = (
        InfraKitchenOAuthProvider(base_url=f"{public_url}{mount_path}", internal_client=internal_client)
        if public_url
        else None
    )

    mcp_server = FastMCP("InfraKitchen", instructions=MCP_INSTRUCTIONS, auth=oauth_provider)

    register_graphql_tools(mcp_server, internal_client, graphql_schema._schema)
    register_rest_write_tools(mcp_server, internal_client)
    register_docs(mcp_server, DEFAULT_DOCS_DIR)

    mcp_http_app = mcp_server.http_app(path="/", stateless_http=True)
    if oauth_provider is None:
        # No public URL configured: OAuth discovery can't work, keep plain bearer-token auth.
        mcp_http_app.add_middleware(BaseHTTPMiddleware, dispatch=_auth_middleware_factory(internal_client))
    else:
        set_oauth_provider(oauth_provider)
        mcp_http_app.add_middleware(BaseHTTPMiddleware, dispatch=_feature_flag_middleware())
        # Clients look up OAuth metadata at the site root (RFC 8414 / RFC 9728 path-insertion).
        for route in oauth_provider.get_well_known_routes(mcp_path="/"):
            fastapi_app.router.routes.insert(0, route)
    fastapi_app.mount(mount_path, mcp_http_app)

    return mcp_http_app
