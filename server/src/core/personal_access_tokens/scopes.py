"""Request-scoped agent-token scope enforcement.

Personal access tokens created with a non-null ``scopes`` list carry a subset
of their owner's permissions. The list is resolved during authentication (see
``core.sso.functions.get_user_from_token``) and stored here so that API-level
permission checks can clamp access to the granted scopes.

Scope format: "<action>:<entity>", e.g. "read:resource", "write:template".
A token with ``scopes = None`` (developer token) is unaffected: no clamping.
"""

from contextvars import ContextVar

# Holds the current request's granted scopes (set[str]) when the request was
# authenticated with a scoped agent token; None otherwise.
current_token_scopes: ContextVar[set[str] | None] = ContextVar("pat_token_scopes", default=None)

current_token_identity: ContextVar[dict[str, str] | None] = ContextVar("pat_token_identity", default=None)


def set_current_token_identity(token_prefix: str | None, token_name: str | None) -> None:
    if token_prefix is None or token_name is None:
        current_token_identity.set(None)
    else:
        current_token_identity.set({"token_prefix": token_prefix, "token_name": token_name})


def get_current_token_identity() -> dict[str, str] | None:
    return current_token_identity.get()


def set_current_token_scopes(scopes: list[str] | None) -> None:
    current_token_scopes.set(set(scopes) if scopes is not None else None)


def get_current_token_scopes() -> set[str] | None:
    """Return the granted scopes of the authenticating token, or None."""
    return current_token_scopes.get()


def scope_allows(scope_set: set[str] | None, action: str, entity: str) -> bool:
    """Check whether the current token's scopes permit ``action`` on ``entity``.

    Important semantics:
    - ``None`` scopes (unscoped developer/service token) => allow unconditionally;
      this function only ever *restricts*, it never grants.
    - "admin" requested via an agent token: an agent token can never perform
      admin actions.

    Returns True when unrestricted or when a matching scope grants it.
    """
    if scope_set is None:
        return True

    # Agent tokens cannot carry admin authority.
    if action == "admin":
        return False

    if f"{action}:{entity}" in scope_set:
        return True

    # "write" implies "read" for the same entity.
    if action == "read" and f"write:{entity}" in scope_set:
        return True

    return False
