import strawberry

from application.use_cases.drift_report.schema import DriftProjectReport, DriftSummary


@strawberry.type
class DriftProjectReportType:
    """Per-project drift report."""

    project_id: str | None
    project_name: str
    score: float
    total: int
    in_sync: int
    drifted: int
    error: int
    unknown: int

    @classmethod
    def from_pydantic(cls, report: DriftProjectReport) -> "DriftProjectReportType":
        return cls(
            project_id=str(report.project_id) if report.project_id else None,
            project_name=report.project_name,
            score=report.score,
            total=report.total,
            in_sync=report.in_sync,
            drifted=report.drifted,
            error=report.error,
            unknown=report.unknown,
        )


@strawberry.type
class DriftSummaryType:
    """Drift summary across all projects."""

    overall_score: float
    projects: list[DriftProjectReportType]

    @classmethod
    def from_pydantic(cls, summary: DriftSummary) -> "DriftSummaryType":
        return cls(
            overall_score=summary.overall_score,
            projects=[DriftProjectReportType.from_pydantic(project) for project in summary.projects],
        )
