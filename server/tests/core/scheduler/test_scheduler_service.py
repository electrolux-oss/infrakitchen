from datetime import datetime
from uuid import uuid4

import pytest
from unittest.mock import Mock, AsyncMock

from pydantic import PydanticUserError

from core.scheduler.crud import SchedulerJobCRUD
from core.scheduler.model import SchedulerJob, JobType
from core.scheduler.schema import SchedulerJobResponse, SchedulerJobCreate
from core.scheduler.service import SchedulerJobService

SQL_SCRIPT = "DELETE from logs"
BASH_SCRIPT = "#!/bin/bash echo hi"
CRON = "*/5 * * * *"


@pytest.fixture
def mock_scheduler_job_crud():
    crud = Mock(spec=SchedulerJobCRUD)
    crud.get_all = AsyncMock()
    crud.create = AsyncMock()
    return crud


@pytest.fixture
def mock_scheduler_job_service(mock_scheduler_job_crud):
    return SchedulerJobService(crud=mock_scheduler_job_crud)


class TestGetAll:
    @pytest.mark.asyncio
    async def test_get_all_empty(self, mock_scheduler_job_service, mock_scheduler_job_crud):
        mock_scheduler_job_crud.get_all.return_value = []

        result = await mock_scheduler_job_service.get_all()

        assert result == []
        mock_scheduler_job_crud.get_all.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_success(self, mock_scheduler_job_service, mock_scheduler_job_crud, monkeypatch):
        jobs = [
            SchedulerJob(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON, created_at=datetime.now()),
            SchedulerJob(id=uuid4(), type=JobType.BASH, script=BASH_SCRIPT, cron=CRON, created_at=datetime.now()),
        ]
        mock_scheduler_job_crud.get_all.return_value = jobs

        sql_scheduler_job_response = SchedulerJobResponse(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON)
        bash_scheduler_job_response = SchedulerJobResponse(id=uuid4(), type=JobType.BASH, script=BASH_SCRIPT, cron=CRON)

        def mock_model_validate(arg):
            return sql_scheduler_job_response if arg.type == JobType.SQL else bash_scheduler_job_response

        monkeypatch.setattr(SchedulerJobResponse, "model_validate", mock_model_validate)

        result = await mock_scheduler_job_service.get_all()

        assert result == [sql_scheduler_job_response, bash_scheduler_job_response]
        mock_scheduler_job_crud.get_all.assert_awaited_once()

    @pytest.mark.asyncio
    async def test_get_all_error(self, mock_scheduler_job_service, mock_scheduler_job_crud, monkeypatch):
        jobs = [SchedulerJob(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON, created_at=datetime.now())]
        mock_scheduler_job_crud.get_all.return_value = jobs

        error = PydanticUserError(message="Error message", code="validate-by-alias-and-name-false")
        monkeypatch.setattr(SchedulerJobResponse, "model_validate", Mock(side_effect=error))

        with pytest.raises(PydanticUserError) as exc:
            await mock_scheduler_job_service.get_all()

        assert exc.value is error
        mock_scheduler_job_crud.get_all.assert_awaited_once()


class TestCreate:
    @pytest.mark.asyncio
    async def test_create_success(self, mock_scheduler_job_service, mock_scheduler_job_crud, monkeypatch):
        job_create = Mock(spec=SchedulerJobCreate)
        job_create_body = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}
        job_create.model_dump = Mock(return_value=job_create_body)

        job = SchedulerJob(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON, created_at=datetime.now())
        scheduler_job_response = SchedulerJobResponse(id=uuid4(), type=JobType.SQL, script=SQL_SCRIPT, cron=CRON)
        mock_scheduler_job_crud.create.return_value = job

        monkeypatch.setattr(SchedulerJobResponse, "model_validate", Mock(return_value=scheduler_job_response))

        result = await mock_scheduler_job_service.create(job_create)

        job_create.model_dump.assert_called_once()
        mock_scheduler_job_crud.create.assert_awaited_once()

        assert result == scheduler_job_response

    @pytest.mark.asyncio
    async def test_create_error(self, mock_scheduler_job_service, mock_scheduler_job_crud):
        job_create = Mock(spec=SchedulerJobCreate)
        job_create_body = {"type": "SQL", "script": SQL_SCRIPT, "cron": CRON}
        job_create.model_dump = Mock(return_value=job_create_body)

        error = RuntimeError("create fail")
        mock_scheduler_job_crud.create.side_effect = error

        with pytest.raises(RuntimeError) as exc:
            await mock_scheduler_job_service.create(job_create)

        assert exc.value is error
        job_create.model_dump.assert_called_once()
        mock_scheduler_job_crud.create.assert_awaited_once()
