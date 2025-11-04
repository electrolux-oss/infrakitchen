import pytest

from unittest.mock import Mock, AsyncMock

from sqlalchemy.ext.asyncio import AsyncSession

from core.errors import CannotProceed
from core.scheduler.executor import SchedulerExecutor
from core.scheduler.model import JobType

SQL_SCRIPT = "DELETE from logs"
BASH_SCRIPT = "#!/bin/bash echo hi"
CRON = "*/5 * * * *"


@pytest.fixture
def mock_session():
    session = Mock(spec=AsyncSession)
    session.execute = AsyncMock()
    return session


@pytest.fixture
def scheduler_executor(mock_session):
    return SchedulerExecutor(session=mock_session)


class TestExecute:
    @pytest.mark.asyncio
    async def test_execute_sql_script_success(self, mock_session, scheduler_executor):
        await scheduler_executor.execute(JobType.SQL, SQL_SCRIPT)

        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_execute_sql_script_error(self, mock_session, scheduler_executor):
        error = RuntimeError("Something went wrong")
        mock_session.execute.side_effect = error

        await scheduler_executor.execute(JobType.SQL, SQL_SCRIPT)

        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_execute_unsupported_job(self, mock_session, scheduler_executor):
        with pytest.raises(CannotProceed):
            await scheduler_executor.execute(JobType.BASH, BASH_SCRIPT)

        mock_session.execute.assert_not_called()
