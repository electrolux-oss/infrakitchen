from collections.abc import AsyncGenerator
from fastapi import Depends

from core.database import SessionLocal

from .crud import RevisionCRUD
from .service import RevisionService

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_revision_service(
    session: AsyncSession = Depends(get_db_session),
) -> RevisionService:
    return RevisionService(
        crud=RevisionCRUD(session=session),
    )
