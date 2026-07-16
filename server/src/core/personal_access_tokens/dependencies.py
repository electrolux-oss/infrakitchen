from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session

from .crud import PersonalAccessTokenCRUD
from .service import PersonalAccessTokenService


def get_personal_access_token_service(
    session: AsyncSession = Depends(get_db_session),
) -> PersonalAccessTokenService:
    return PersonalAccessTokenService(crud=PersonalAccessTokenCRUD(session=session))
