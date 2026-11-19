from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from sqlalchemy.dialects import postgresql

from application.resource_drifts.model import DriftSettingsDTO
from application.use_cases.drift_report.service import DriftReportService
from core.constants.model import DriftStatus


def make_service(rows=None) -> DriftReportService:
    settings_service = Mock(get=AsyncMock(return_value=DriftSettingsDTO(enabled=True)))
    service = DriftReportService(session=Mock(), settings_service=settings_service)
    if rows is not None:
        service.count_rows = AsyncMock(return_value=rows)
    return service


def counts_sql(enabled_globally: bool) -> str:
    statement = make_service().counts_statement(enabled_globally)
    return str(statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))


async def test_report_without_resources_is_empty():
    report = await make_service([]).get_report()

    assert report.total == 0
    assert report.projects == []


async def test_report_counts_each_project_by_result_and_failing_checks_apart():
    p1, p2 = uuid4(), uuid4()
    rows = [
        (p1, "alpha", DriftStatus.IN_SYNC, 3, 1),
        (p1, "alpha", DriftStatus.DRIFTED, 1, 0),
        (p1, "alpha", DriftStatus.UNKNOWN, 2, 0),
        (p1, "alpha", None, 4, 0),
        (p2, "beta", DriftStatus.IN_SYNC, 2, 0),
        (p2, "beta", DriftStatus.ERROR, 1, 1),
        (None, None, DriftStatus.DRIFTED, 2, 0),
    ]

    report = await make_service(rows).get_report()

    by_name = {project.project_name: project for project in report.projects}
    alpha, beta = by_name["alpha"], by_name["beta"]
    assert (alpha.total, alpha.drifted, alpha.unchecked, alpha.failing) == (10, 1, 6, 1)
    assert (beta.in_sync, beta.error, beta.failing) == (2, 1, 1)
    assert (report.total, report.in_sync, report.drifted, report.error, report.unchecked, report.failing) == (
        15,
        5,
        3,
        1,
        6,
        2,
    )
    # most drift first, then most failing checks
    assert [project.project_name for project in report.projects] == ["Unassigned", "alpha", "beta"]


def test_only_resources_a_check_can_run_on_are_counted():
    sql = counts_sql(enabled_globally=True)

    assert "resources.state = 'PROVISIONED'" in sql
    assert "resources.abstract IS false" in sql
    assert "source_codes.source_code_language = 'opentofu'" in sql


def test_resources_of_projects_without_scheduled_checks_count_only_once_checked():
    # otherwise they would stay "unchecked" forever
    sql = counts_sql(enabled_globally=False)

    assert "drift_detection" in sql
    assert "OR resource_drifts.id IS NOT NULL" in sql
