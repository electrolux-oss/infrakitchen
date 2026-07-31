from collections import defaultdict
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from application.projects.model import Project
from application.resources.model import Resource
from application.source_code_versions.model import SourceCodeVersion
from core.constants.model import ModelStatus, VersionLifecycleState

from .schema import GoldenStateProjectReport, GoldenStateSummary


def _classify_resource(
    current_lifecycle_state: str | None,
    current_scv_id: UUID | None,
    active_scv_ids: set[UUID],
    golden_scv_id: UUID | None,
    golden_breaking_changes: str | None,
) -> str:
    if golden_scv_id is None:
        return "no_golden"

    if current_scv_id is None:
        return "critical"

    if current_scv_id in active_scv_ids:
        return "compliant"

    state = (current_lifecycle_state or "").lower()

    if state == VersionLifecycleState.ARCHIVED:
        return "critical"

    if state == VersionLifecycleState.DEPRECATED:
        return "deprecated"

    if golden_breaking_changes and golden_breaking_changes.strip():
        return "critical"

    return "update_available"


def _compute_score(compliant: int, total_comparable: int) -> float:
    if total_comparable == 0:
        return 100.0
    return round((compliant / total_comparable) * 100, 1)


async def _get_active_versions_by_template_ids(
    session: AsyncSession, template_ids: list[UUID]
) -> tuple[dict[UUID, SourceCodeVersion], dict[UUID, set[UUID]]]:
    if not template_ids:
        return {}, {}

    statement = (
        select(SourceCodeVersion)
        .where(
            SourceCodeVersion.template_id.in_(template_ids),
            SourceCodeVersion.lifecycle_state == VersionLifecycleState.ACTIVE,
            SourceCodeVersion.status != ModelStatus.DISABLED,
        )
        .order_by(SourceCodeVersion.index.desc())
    )
    result = await session.execute(statement)
    active_map: dict[UUID, SourceCodeVersion] = {}
    active_ids_map: dict[UUID, set[UUID]] = defaultdict(set)
    for scv in result.unique().scalars().all():
        active_ids_map[scv.template_id].add(scv.id)
        if scv.template_id not in active_map:
            active_map[scv.template_id] = scv
    return active_map, dict(active_ids_map)


class GoldenStateReportService:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_summary(self, project_id: UUID | None = None) -> GoldenStateSummary:
        statement = select(
            Resource.id,
            Resource.template_id,
            Resource.source_code_version_id,
            Resource.project_id,
        ).where(Resource.abstract.is_(False))
        if project_id:
            statement = statement.where(Resource.project_id == project_id)
        result = await self.session.execute(statement)
        resources = result.all()

        if not resources:
            return GoldenStateSummary(overall_score=100.0, projects=[])

        template_ids: set[UUID] = set()
        scv_ids: set[UUID] = set()
        project_ids: set[UUID] = set()

        for resource in resources:
            template_ids.add(resource.template_id)
            if resource.source_code_version_id:
                scv_ids.add(resource.source_code_version_id)
            if resource.project_id:
                project_ids.add(resource.project_id)

        golden_map, active_ids_map = await _get_active_versions_by_template_ids(self.session, list(template_ids))

        scv_lifecycle_map: dict[UUID, str] = {}
        if scv_ids:
            scv_statement = select(SourceCodeVersion.id, SourceCodeVersion.lifecycle_state).where(
                SourceCodeVersion.id.in_(list(scv_ids))
            )
            scv_result = await self.session.execute(scv_statement)
            for scv_row in scv_result.all():
                scv_lifecycle_map[scv_row.id] = scv_row.lifecycle_state or ""

        project_name_map: dict[UUID, str] = {}
        if project_ids:
            project_statement = select(Project.id, Project.name).where(Project.id.in_(list(project_ids)))
            project_result = await self.session.execute(project_statement)
            for project_row in project_result.all():
                project_name_map[project_row.id] = project_row.name

        project_buckets: dict[UUID | None, list[str]] = defaultdict(list)
        for resource in resources:
            golden_scv = golden_map.get(resource.template_id)
            status = _classify_resource(
                current_lifecycle_state=(
                    scv_lifecycle_map.get(resource.source_code_version_id) if resource.source_code_version_id else None
                ),
                current_scv_id=resource.source_code_version_id,
                active_scv_ids=active_ids_map.get(resource.template_id, set()),
                golden_scv_id=golden_scv.id if golden_scv else None,
                golden_breaking_changes=golden_scv.breaking_changes if golden_scv else None,
            )
            project_buckets[resource.project_id].append(status)

        project_reports: list[GoldenStateProjectReport] = []
        total_compliant = 0
        total_comparable = 0

        for project_id, statuses in project_buckets.items():
            compliant = statuses.count("compliant")
            update_available = statuses.count("update_available")
            deprecated = statuses.count("deprecated")
            critical = statuses.count("critical")
            no_golden = statuses.count("no_golden")
            total = len(statuses)
            comparable = total - no_golden
            score = _compute_score(compliant, comparable)

            total_compliant += compliant
            total_comparable += comparable

            project_reports.append(
                GoldenStateProjectReport(
                    project_id=project_id,
                    project_name=project_name_map.get(project_id, "Unknown") if project_id else "Unassigned",
                    score=score,
                    total=total,
                    compliant=compliant,
                    update_available=update_available,
                    deprecated=deprecated,
                    critical=critical,
                    no_golden=no_golden,
                )
            )

        project_reports.sort(key=lambda report: report.score)

        return GoldenStateSummary(
            overall_score=_compute_score(total_compliant, total_comparable),
            projects=project_reports,
        )
