from fastapi import Request

RETURN_TO_COOKIE = "ik-return-to"
RETURN_TO_PREFIX = "/api/mcp-oauth/"


def post_login_url(request: Request) -> str:
    """Where SSO callbacks send the browser: back into the MCP OAuth flow if one is in progress."""
    target = request.cookies.get(RETURN_TO_COOKIE)
    if target and target.startswith(RETURN_TO_PREFIX) and "//" not in target and "\\" not in target:
        return target
    return "/"
