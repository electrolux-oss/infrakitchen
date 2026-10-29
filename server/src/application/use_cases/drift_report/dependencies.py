from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session

from .service import DriftReportService


def get_drift_report_service(
    session: AsyncSession = Depends(get_db_session),
) -> DriftReportService:
    return DriftReportService(session=session)
