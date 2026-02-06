from contextvars import ContextVar

request_auth_token: ContextVar[str | None] = ContextVar("mcp_token", default=None)
