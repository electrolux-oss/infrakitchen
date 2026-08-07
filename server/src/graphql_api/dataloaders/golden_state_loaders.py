from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from strawberry.dataloader import DataLoader

from application.use_cases.golden_state_report.dependencies import get_golden_state_report_service
from graphql_api.modules.golden_state.types import GoldenStateProjectReportType


async def _load_golden_state_by_project(
    keys: list[str], session: AsyncSession
) -> list[GoldenStateProjectReportType | None]:
    service = get_golden_state_report_service(session)
    if len(keys) == 1:
        summary = await service.get_summary(project_id=UUID(keys[0]))
    else:
        summary = await service.get_summary(project_id=None)
    reports = {
        str(report.project_id): GoldenStateProjectReportType.from_pydantic(report)
        for report in summary.projects
        if report.project_id is not None
    }
    return [reports.get(key) for key in keys]


def golden_state_loaders(
    session: AsyncSession,
) -> dict[str, DataLoader[str, GoldenStateProjectReportType | None]]:
    return {
        "project_golden_state": DataLoader[str, GoldenStateProjectReportType | None](
            load_fn=lambda keys: _load_golden_state_by_project(list(keys), session)
        )
    }
