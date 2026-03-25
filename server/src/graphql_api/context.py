import logging
from typing import Any

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session
from core.sso.functions import get_logged_user

logger = logging.getLogger(__name__)


async def get_context(
    session: AsyncSession = Depends(get_db_session),
    user=Depends(get_logged_user),
) -> dict[str, Any]:
    return {"session": session, "user": user}
