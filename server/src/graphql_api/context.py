import logging
from typing import Any

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session
from core.sso.dependencies import get_sso_service
from core.sso.functions import get_user_from_token
from core.sso.service import SSOService

logger = logging.getLogger(__name__)

_optional_bearer = HTTPBearer(auto_error=False)


async def get_context(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    token: HTTPAuthorizationCredentials | None = Depends(_optional_bearer),
    service: SSOService = Depends(get_sso_service),
) -> dict[str, Any]:
    user = None
    if token:
        user = await get_user_from_token(service, token.credentials)
        if user is not None:
            request.state.user = user
    return {"session": session, "user": user}
