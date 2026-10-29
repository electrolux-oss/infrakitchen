from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

from application.use_cases.drift_report.service import DriftReportService, _compute_score
from core.constants.model import DriftStatus


def test_score_ignores_resources_that_were_not_checked():
    assert _compute_score(in_sync=3, checked=4) == 75.0
    assert _compute_score(in_sync=0, checked=0) == 100.0


def make_session(counts_rows, project_rows=()):
    counts = Mock(all=Mock(return_value=counts_rows))
    projects = Mock(all=Mock(return_value=list(project_rows)))
    return Mock(execute=AsyncMock(side_effect=[counts, projects]))


async def test_summary_without_resources_is_fully_in_sync():
    session = Mock(execute=AsyncMock(return_value=Mock(all=Mock(return_value=[]))))

    summary = await DriftReportService(session).get_summary()

    assert summary.overall_score == 100.0
    assert summary.projects == []


async def test_summary_scores_each_project_and_overall():
    p1, p2 = uuid4(), uuid4()
    rows = [
        (p1, DriftStatus.IN_SYNC, 3),
        (p1, DriftStatus.DRIFTED, 1),
        (p1, DriftStatus.UNKNOWN, 6),
        (p2, DriftStatus.IN_SYNC, 2),
        (p2, DriftStatus.ERROR, 1),
        (None, DriftStatus.DRIFTED, 1),
    ]
    session = make_session(rows, [SimpleNamespace(id=p1, name="alpha"), SimpleNamespace(id=p2, name="beta")])

    summary = await DriftReportService(session).get_summary()

    by_name = {project.project_name: project for project in summary.projects}
    assert by_name["alpha"].score == 75.0
    assert (by_name["alpha"].total, by_name["alpha"].unknown) == (10, 6)
    assert by_name["beta"].score == round(2 / 3 * 100, 1)
    assert by_name["beta"].error == 1
    assert by_name["Unassigned"].score == 0.0
    # 5 in sync of 8 checked resources (drifted and failed checks count); unknown ones are left out
    assert summary.overall_score == round(5 / 8 * 100, 1)
    # the worst project comes first
    assert summary.projects[0].project_name == "Unassigned"
