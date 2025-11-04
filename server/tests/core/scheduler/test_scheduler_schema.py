# pyright: reportAttributeAccessIssue=false
import pytest
from pydantic_core import ValidationError

from core.scheduler.model import JobType
from core.scheduler.schema import SchedulerJobCreate

SQL_SCRIPT = "DELETE from logs"
BASH_SCRIPT = "#!/bin/bash echo hi"
CRON = "*/5 * * * *"


class TestSchedulerJobCreate:
    def test_scheduler_job_create_with_valid_cron_and_script(self):
        result = SchedulerJobCreate(type=JobType.SQL, script=SQL_SCRIPT, cron=CRON)

        assert result is not None

    def test_scheduler_job_create_with_valid_bash_script(self):
        result = SchedulerJobCreate(type=JobType.BASH, script=BASH_SCRIPT, cron=CRON)

        assert result is not None

    def test_scheduler_job_create_with_invalid_cron(self):
        with pytest.raises(ValueError) as e:
            SchedulerJobCreate(type=JobType.SQL, script=SQL_SCRIPT, cron="* * * * * *")

        errors = e.value.errors()

        assert e.type is ValidationError
        assert errors[0]["loc"] == ("cron",)
        assert errors[0]["msg"].startswith("Value error, Invalid cron expression:")

    def test_scheduler_job_create_with_invalid_sql(self):
        with pytest.raises(ValueError) as e:
            SchedulerJobCreate(type=JobType.SQL, script="INVALID SCRIPT", cron="* * * * *")

        errors = e.value.errors()

        assert e.type is ValidationError
        assert errors[0]["loc"] == ("script",)
        assert errors[0]["msg"].startswith("Value error, Invalid SQL:")

    def test_scheduler_job_create_with_invalid_bash(self):
        with pytest.raises(ValueError) as e:
            SchedulerJobCreate(type=JobType.BASH, script="####!", cron="* * * * *")

        errors = e.value.errors()

        assert e.type is ValidationError
        assert errors[0]["loc"] == ("script",)
        assert errors[0]["msg"].startswith("Value error, Invalid Bash:")
