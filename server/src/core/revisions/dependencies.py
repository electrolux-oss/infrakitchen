from fastapi import Depends

from core.dependencies import get_db_session

from .crud import RevisionCRUD
from .service import RevisionService

from sqlalchemy.ext.asyncio import AsyncSession


def get_revision_service(
    session: AsyncSession = Depends(get_db_session),
) -> RevisionService:
    return RevisionService(
        crud=RevisionCRUD(session=session),
    )
