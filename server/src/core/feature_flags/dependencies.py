from fastapi import Depends

from core.audit_logs.handler import AuditLogHandler
from core.dependencies import get_db_session
from core.feature_flags.crud import FeatureFlagCRUD
from .service import FeatureFlagService

from sqlalchemy.ext.asyncio import AsyncSession


def get_feature_flag_service(
    session: AsyncSession = Depends(get_db_session),
) -> FeatureFlagService:
    return FeatureFlagService(
        crud=FeatureFlagCRUD(session=session),
        audit_log_handler=AuditLogHandler(session=session, entity_name="feature_flag"),
    )
