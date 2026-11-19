import strawberry

from application.resource_drifts.model import DriftSettingsDTO
from application.use_cases.drift_report.schema import DriftProjectReport, DriftReport


@strawberry.type
class DriftProjectReportType:
    project_id: str | None
    project_name: str
    total: int
    in_sync: int
    drifted: int
    error: int
    unchecked: int
    failing: int

    @classmethod
    def from_pydantic(cls, report: DriftProjectReport) -> "DriftProjectReportType":
        return cls(
            project_id=str(report.project_id) if report.project_id else None,
            project_name=report.project_name,
            total=report.total,
            in_sync=report.in_sync,
            drifted=report.drifted,
            error=report.error,
            unchecked=report.unchecked,
            failing=report.failing,
        )


@strawberry.type
class DriftReportType:
    """Drift counts of the provisioned resources, overall and per project."""

    total: int
    in_sync: int
    drifted: int
    error: int
    unchecked: int
    failing: int
    projects: list[DriftProjectReportType]

    @classmethod
    def from_pydantic(cls, report: DriftReport) -> "DriftReportType":
        return cls(
            total=report.total,
            in_sync=report.in_sync,
            drifted=report.drifted,
            error=report.error,
            unchecked=report.unchecked,
            failing=report.failing,
            projects=[DriftProjectReportType.from_pydantic(project) for project in report.projects],
        )


@strawberry.type
class DriftSettingsType:
    enabled: bool
    interval_hours: int

    @classmethod
    def from_pydantic(cls, settings: DriftSettingsDTO) -> "DriftSettingsType":
        return cls(enabled=settings.enabled, interval_hours=settings.interval_hours)


@strawberry.input
class DriftSettingsInput:
    enabled: bool
    interval_hours: int
