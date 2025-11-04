from datetime import datetime
from uuid import uuid4

import pytest
from unittest.mock import Mock, AsyncMock

from sqlalchemy import Result, ScalarResult
from sqlalchemy.ext.asyncio import AsyncSession

from core.scheduler.crud import SchedulerJobCRUD
from core.scheduler.model import SchedulerJob, JobType

SQL_SCRIPT = "DELETE from logs"
BASH_SCRIPT = "#!/bin/bash echo hi"
CRON = "*/5 * * * *"


@pytest.fixture
def mock_session():
    session = Mock(spec=AsyncSession)
    session.execute = AsyncMock()
    session.flush = AsyncMock()
    return session


@pytest.fixture
def scheduler_job_crud(mock_session):
    return SchedulerJobCRUD(session=mock_session)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_session, scheduler_job_crud):
        mock_execute_result = Mock(spec=Result)
        mock_scalar_result = Mock(spec=ScalarResult)
        mock_session.execute.return_value = mock_execute_result
        mock_execute_result.scalars.return_value = mock_scalar_result
        mock_scalar_result.all.return_value = []

        result = await scheduler_job_crud.get_all()

        assert result == []
        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_session, scheduler_job_crud):
        jobs = [
            SchedulerJob(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON, created_at=datetime.now()),
            SchedulerJob(id=uuid4(), type=JobType.BASH, script=BASH_SCRIPT, cron=CRON, created_at=datetime.now()),
        ]
        mock_execute_result = Mock(spec=Result)
        mock_scalar_result = Mock(spec=ScalarResult)
        mock_session.execute.return_value = mock_execute_result
        mock_execute_result.scalars.return_value = mock_scalar_result
        mock_scalar_result.all.return_value = jobs

        result = await scheduler_job_crud.get_all()

        assert len(result) == 2
        mock_session.execute.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_session, scheduler_job_crud):
        error = RuntimeError("Something went wrong")
        mock_session.execute.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await scheduler_job_crud.get_all()

        assert exc.value is error
        mock_session.execute.assert_awaited_once()


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(self, mock_session, scheduler_job_crud):
        job = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}

        result = await scheduler_job_crud.create(job)

        mock_session.add.assert_called_once()
        mock_session.flush.assert_awaited_once()

        assert result.type == "SQL"
        assert result.script == SQL_SCRIPT
        assert result.cron == CRON

    @pytest.mark.asyncio
    async def test_create_error(self, mock_session, scheduler_job_crud):
        job = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}

        error = RuntimeError("create fail")
        mock_session.flush.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await scheduler_job_crud.create(job)

        assert exc.value is error
        mock_session.add.assert_called_once()
        mock_session.flush.assert_awaited_once()
