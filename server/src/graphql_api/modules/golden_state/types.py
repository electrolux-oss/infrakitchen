import strawberry

from application.use_cases.golden_state_report.schema import GoldenStateProjectReport, GoldenStateSummary


@strawberry.type
class GoldenStateResourceType:
    """Per-resource golden state compliance status."""

    resource_id: str
    resource_name: str
    template_name: str
    current_version: str | None
    golden_version: str | None
    status: str
    breaking_changes: str | None


@strawberry.type
class GoldenStateProjectReportType:
    """Per-project golden state compliance report."""

    project_id: str | None
    project_name: str
    score: float
    total: int
    compliant: int
    update_available: int
    deprecated: int
    critical: int
    no_golden: int

    @classmethod
    def from_pydantic(cls, report: GoldenStateProjectReport) -> "GoldenStateProjectReportType":
        return cls(
            project_id=str(report.project_id) if report.project_id else None,
            project_name=report.project_name,
            score=report.score,
            total=report.total,
            compliant=report.compliant,
            update_available=report.update_available,
            deprecated=report.deprecated,
            critical=report.critical,
            no_golden=report.no_golden,
        )


@strawberry.type
class GoldenStateSummaryType:
    """Overall golden state compliance summary across all accessible projects."""

    overall_score: float
    projects: list[GoldenStateProjectReportType]

    @classmethod
    def from_pydantic(cls, summary: GoldenStateSummary) -> "GoldenStateSummaryType":
        return cls(
            overall_score=summary.overall_score,
            projects=[GoldenStateProjectReportType.from_pydantic(project) for project in summary.projects],
        )
