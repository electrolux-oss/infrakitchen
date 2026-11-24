"""Log access for scoped personal access tokens.

Logs belong to another entity (``Log.entity``, e.g. "resource"). A scoped token
does not need a separate log scope: a read or write scope on an entity type
includes the logs of that type, and nothing else.
"""

from typing import Any

from strawberry.types import Info

from core.audit_logs.functions import audit_permission_denial
from core.errors import AccessDenied
from core.personal_access_tokens.scopes import get_current_token_scopes, readable_entities
from graphql_api.helpers import check_user_api_permission


async def log_entities_allowed(info: Info) -> set[str] | None:
    """Check log read access and return the entity types the caller may read logs for.

    Returns None when access is not limited by entity type (no scoped token).
    """
    await check_user_api_permission(info, "log", ["read"])
    scopes = get_current_token_scopes()
    if scopes is None:
        return None
    return readable_entities(scopes)


async def check_log_entity_access(info: Info, entity_name: str) -> None:
    """Check log read access for the logs of a single entity type."""
    allowed = await log_entities_allowed(info)
    if allowed is not None and entity_name not in allowed:
        await audit_permission_denial(
            None,
            info.context["user"].id,
            entity_name="log",
            policies=["read"],
            limited_by="token_scopes",
        )
        raise AccessDenied(f"Access denied. The token's granted scopes do not allow read {entity_name} logs.")


def restrict_log_filter(filter: dict[str, Any] | None, allowed: set[str] | None) -> dict[str, Any] | None:
    """Limit a logs filter to the allowed entity types.

    The caller's filter is nested under "or" (a single branch) so its own keys
    cannot override the entity restriction.
    """
    if allowed is None:
        return filter
    restricted: dict[str, Any] = {"entity__in": list(allowed)}
    if filter:
        restricted["or"] = [filter]
    return restricted
