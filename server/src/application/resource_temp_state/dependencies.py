from collections.abc import AsyncGenerator

from fastapi import Depends
from sqlalchemy.ext.asyncio.session import AsyncSession

from core.database import SessionLocal
from application.resource_temp_state.crud import ResourceTempStateCrud
from application.resource_temp_state.service import ResourceTempStateService


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_resource_temp_state_service(
    session: AsyncSession = Depends(get_db_session),
) -> ResourceTempStateService:
    return ResourceTempStateService(
        crud=ResourceTempStateCrud(session=session),
    )
