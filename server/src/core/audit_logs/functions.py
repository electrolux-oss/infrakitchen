"""Audit logging for permission denials.

``check_api_permission`` in ``graphql_api.helpers`` (GraphQL) and its REST
counterpart in ``core.sso.functions`` record every denial in the audit log
under the entity the request targeted, with metadata explaining why: which
policy/entity was requested, the user id, whether a scoped PAT's scopes or
the owner's roles were the limiting factor, and the captured request
User-Agent. The write is fire-and-forget on its own committed session —
auditing a denial must never turn a 403 into a 500.
"""

import logging
import uuid
from uuid import UUID

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_async_session
from core.personal_access_tokens.scopes import get_current_token_identity
from core.request_context import get_current_user_agent

logger = logging.getLogger(__name__)

DENIED_OUTCOME = "denied"


async def audit_permission_denial(
    entity_id: str | UUID | None,
    user_id: str | UUID | None,
    *,
    entity_name: str,
    policies: list[str],
    limited_by: str,
) -> None:
    """Record a permission denial and never raise.

    The audit row's action is the *attempted* operation (the first requested
    policy, e.g. ``read``) so the Event column reads like any other audit
    row; the denial itself is the outcome and lands in the metadata under
    ``denied`` for the UI's Result column. ``entity_id`` is the requested
    target when the caller obtained one — else ``None``, which maps to the
    zero UUID sentinel.
    """
    metadata: dict[str, str] = {}
    metadata["entity"] = entity_name
    metadata["policies"] = ", ".join(policies)
    metadata[DENIED_OUTCOME] = "true"
    metadata["limited_by"] = limited_by
    if user_id is not None:
        metadata["user_id"] = str(user_id)
    token_identity = get_current_token_identity()
    if token_identity is not None:
        metadata["token_prefix"] = token_identity["token_prefix"]
        metadata["token_name"] = token_identity["token_name"]
    user_agent = get_current_user_agent()
    if user_agent is not None:
        metadata["user_agent"] = user_agent
    try:
        async with get_async_session() as session:
            await AuditLogHandler(session, entity_name=entity_name).create_log(
                entity_id or uuid.UUID(int=0),
                user_id or uuid.UUID(int=0),
                policies[0],
                action_metadata=metadata,
            )
            await session.commit()
    except Exception:
        logger.warning("Failed to audit permission denial", exc_info=True)
