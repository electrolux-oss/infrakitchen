import asyncio
import logging
from typing import Any

from fastapi import Depends, Request
from starlette.requests import HTTPConnection
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session
from core.sso.dependencies import get_sso_service
from core.sso.functions import get_user_from_token
from core.sso.service import SSOService
from graphql_api.dataloaders import create_entity_loaders
from graphql_api.locked_session import LockedSession

logger = logging.getLogger(__name__)


async def get_context(
    connection: HTTPConnection,
    session: AsyncSession = Depends(get_db_session),
    service: SSOService = Depends(get_sso_service),
) -> dict[str, Any]:
    user = None

    # Extract bearer token from the Authorization header.
    # Using HTTPConnection (base of both Request and WebSocket) so the
    # same context getter works for HTTP queries and WS subscriptions.
    auth_header = connection.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        token_str = auth_header[7:]
        user = await get_user_from_token(service, token_str)
        if user is not None and isinstance(connection, Request):
            connection.state.user = user

    # Wrap the session so concurrent GraphQL resolvers serialise their
    # execute() calls through an asyncio.Lock.
    session_lock = asyncio.Lock()
    locked = LockedSession(session, session_lock)

    return {
        "session": locked,
        "user": user,
        "request": connection,
        "sso_service": service,
        "loaders": create_entity_loaders(locked),
    }
