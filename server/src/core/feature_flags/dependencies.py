from collections.abc import AsyncGenerator

from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.feature_flags.crud import FeatureFlagCRUD
from .service import FeatureFlagService
from core.database import SessionLocal

from sqlalchemy.ext.asyncio import AsyncSession


async def get_db_session() -> AsyncGenerator[AsyncSession]:
    async with SessionLocal() as session:
        async with session.begin():
            yield session


def get_feature_flag_service(
    session: AsyncSession = Depends(get_db_session),
) -> FeatureFlagService:
    return FeatureFlagService(
        crud=FeatureFlagCRUD(session=session),
        audit_log_handler=AuditLogHandler(session=session, entity_name="feature_flag"),
    )
