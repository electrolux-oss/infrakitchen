from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_db_session

from .service import GoldenStateReportService


def get_golden_state_report_service(
    session: AsyncSession = Depends(get_db_session),
) -> GoldenStateReportService:
    return GoldenStateReportService(session=session)
