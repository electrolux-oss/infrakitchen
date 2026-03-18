from fastapi import Depends
from sqlalchemy.ext.asyncio.session import AsyncSession

from application.resource_temp_state.crud import ResourceTempStateCrud
from application.resource_temp_state.service import ResourceTempStateService
from core.dependencies import get_db_session


def get_resource_temp_state_service(
    session: AsyncSession = Depends(get_db_session),
) -> ResourceTempStateService:
    return ResourceTempStateService(
        crud=ResourceTempStateCrud(session=session),
    )
