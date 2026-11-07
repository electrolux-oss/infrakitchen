from collections import defaultdict
from uuid import UUID

from sqlalchemy import Select, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.model import Project
from application.resource_drifts.model import ResourceDrift
from application.resource_drifts.service import DriftSettingsService
from application.resources.crud import ResourceCRUD
from application.resources.model import Resource
from core.constants.model import DriftStatus

from .schema import DriftProjectReport, DriftReport

# (project id, project name, drift status, resources, resources whose last check failed)
CountRow = tuple[UUID | None, str | None, DriftStatus | None, int, int]


class DriftReportService:
    """Drift counts per project of the resources drift checks can run on."""

    def __init__(self, session: AsyncSession, settings_service: DriftSettingsService):
        self.session: AsyncSession = session
        self.settings_service: DriftSettingsService = settings_service

    def counts_statement(
        self, enabled_globally: bool, project_id: UUID | None = None
    ) -> Select[UUID | None, str, DriftStatus, int, int]:
        """
        Resources the scheduler checks, plus the ones checked by hand in projects without scheduled checks.
        Resources a check can't run on (not OpenTofu, abstract, not provisioned) are left out.
        """
        statement = (
            select(
                Resource.project_id,
                Project.name,
                ResourceDrift.status,
                func.count(),
                func.count().filter(ResourceDrift.consecutive_failures > 0),
            )
            .select_from(Resource)
            .outerjoin(Project, Project.id == Resource.project_id)
            .outerjoin(ResourceDrift, ResourceDrift.resource_id == Resource.id)
            .where(
                *ResourceCRUD.drift_check_supported(),
                or_(ResourceCRUD.drift_detection_enabled(enabled_globally), ResourceDrift.id.is_not(None)),
            )
            .group_by(Resource.project_id, Project.name, ResourceDrift.status)
        )
        if project_id:
            statement = statement.where(Resource.project_id == project_id)
        return statement

    async def count_rows(self, project_id: UUID | None = None) -> list[CountRow]:
        settings = await self.settings_service.get()
        rows = (await self.session.execute(self.counts_statement(settings.enabled, project_id))).all()
        return [(row[0], row[1], row[2], row[3], row[4]) for row in rows]

    async def get_report(self, project_id: UUID | None = None) -> DriftReport:
        names: dict[UUID | None, str] = {}
        counts: dict[UUID | None, dict[DriftStatus | None, int]] = defaultdict(lambda: defaultdict(int))
        failing: dict[UUID | None, int] = defaultdict(int)
        for row_project_id, project_name, status, count, failing_count in await self.count_rows(project_id):
            names[row_project_id] = project_name or ("Unknown" if row_project_id else "Unassigned")
            counts[row_project_id][status] += count
            failing[row_project_id] += failing_count

        projects = [
            DriftProjectReport(
                project_id=pid,
                project_name=names[pid],
                total=sum(by_status.values()),
                in_sync=by_status[DriftStatus.IN_SYNC],
                drifted=by_status[DriftStatus.DRIFTED],
                error=by_status[DriftStatus.ERROR],
                unchecked=by_status[None] + by_status[DriftStatus.UNKNOWN],
                failing=failing[pid],
            )
            for pid, by_status in counts.items()
        ]
        # most drift first, then most failing checks
        projects.sort(key=lambda report: (-report.drifted, -report.failing, report.project_name))
        return DriftReport(
            total=sum(report.total for report in projects),
            in_sync=sum(report.in_sync for report in projects),
            drifted=sum(report.drifted for report in projects),
            error=sum(report.error for report in projects),
            unchecked=sum(report.unchecked for report in projects),
            failing=sum(report.failing for report in projects),
            projects=projects,
        )
