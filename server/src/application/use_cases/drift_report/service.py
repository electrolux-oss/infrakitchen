from collections import defaultdict
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.model import Project
from application.resource_drifts.model import ResourceDrift
from application.resources.model import Resource
from core.constants.model import DriftStatus, ModelState

from .schema import DriftProjectReport, DriftSummary


def _compute_score(in_sync: int, checked: int) -> float:
    """Share of the checked resources that match their state; failed checks count against it, unchecked ones don't."""
    if checked == 0:
        return 100.0
    return round((in_sync / checked) * 100, 1)


class DriftReportService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_summary(self, project_id: UUID | None = None) -> DriftSummary:
        statement = (
            select(Resource.project_id, ResourceDrift.status, func.count())
            .outerjoin(ResourceDrift, ResourceDrift.resource_id == Resource.id)
            .where(Resource.abstract.is_(False), Resource.state == ModelState.PROVISIONED)
            .group_by(Resource.project_id, ResourceDrift.status)
        )
        if project_id:
            statement = statement.where(Resource.project_id == project_id)
        rows = (await self.session.execute(statement)).all()

        if not rows:
            return DriftSummary(overall_score=100.0, projects=[])

        counts: dict[UUID | None, dict[DriftStatus, int]] = defaultdict(lambda: defaultdict(int))
        for row_project_id, drift_status, count in rows:
            # a resource that was never checked has no drift row
            counts[row_project_id][drift_status or DriftStatus.UNKNOWN] += count

        project_ids = [pid for pid in counts if pid is not None]
        project_name_map: dict[UUID, str] = {}
        if project_ids:
            project_rows = await self.session.execute(
                select(Project.id, Project.name).where(Project.id.in_(project_ids))
            )
            project_name_map = {row.id: row.name for row in project_rows.all()}

        reports: list[DriftProjectReport] = []
        total_in_sync = 0
        total_checked = 0
        for row_project_id, by_status in counts.items():
            in_sync = by_status[DriftStatus.IN_SYNC]
            drifted = by_status[DriftStatus.DRIFTED]
            checked = in_sync + drifted + by_status[DriftStatus.ERROR]
            total_in_sync += in_sync
            total_checked += checked
            reports.append(
                DriftProjectReport(
                    project_id=row_project_id,
                    project_name=project_name_map.get(row_project_id, "Unknown") if row_project_id else "Unassigned",
                    score=_compute_score(in_sync, checked),
                    total=sum(by_status.values()),
                    in_sync=in_sync,
                    drifted=drifted,
                    error=by_status[DriftStatus.ERROR],
                    unknown=by_status[DriftStatus.UNKNOWN],
                )
            )

        reports.sort(key=lambda report: report.score)
        return DriftSummary(overall_score=_compute_score(total_in_sync, total_checked), projects=reports)
