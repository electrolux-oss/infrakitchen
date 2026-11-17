from contextvars import ContextVar

from fastmcp.server.dependencies import get_access_token

request_auth_token: ContextVar[str | None] = ContextVar("mcp_token", default=None)


def get_request_authorization() -> str | None:
    """Authorization header value to forward to the internal API for the current MCP request."""
    explicit = request_auth_token.get(None)
    if explicit:
        return explicit
    access_token = get_access_token()
    if access_token is None:
        return None
    return access_token.claims.get("ik_authorization")
