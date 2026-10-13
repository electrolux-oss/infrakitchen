"""Request-scoped User-Agent capture.

PAT authentication audits include the client's User-Agent. The auth chain
(``get_user_from_token``) has no access to the FastAPI ``Request`` object,
so the HTTP entry points place the header here instead of threading a
parameter through every signature. Reads return ``None`` outside a request
or when the client sent no header.
"""

from contextvars import ContextVar

current_user_agent: ContextVar[str | None] = ContextVar("current_user_agent", default=None)


def set_current_user_agent(user_agent: str | None) -> None:
    current_user_agent.set(user_agent)


def get_current_user_agent() -> str | None:
    return current_user_agent.get()
