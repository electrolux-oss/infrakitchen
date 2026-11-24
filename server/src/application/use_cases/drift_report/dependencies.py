from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from application.resource_drifts.dependencies import get_drift_settings_service
from core.dependencies import get_db_session

from .service import DriftReportService


def get_drift_report_service(
    session: AsyncSession = Depends(get_db_session),
) -> DriftReportService:
    return DriftReportService(session=session, settings_service=get_drift_settings_service(session=session))
