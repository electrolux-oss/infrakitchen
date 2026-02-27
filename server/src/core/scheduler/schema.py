import re
from datetime import datetime
import uuid
from typing import Literal
from .model import JobType

from pydantic import BaseModel, Field, ConfigDict, field_validator, ValidationInfo
from apscheduler.triggers.cron import CronTrigger

VALID_STATEMENTS = {"SELECT", "INSERT", "UPDATE", "DELETE", "CREATE", "ALTER", "DROP", "TRUNCATE"}
SQL_START = re.compile(r"^(?:" + "|".join(VALID_STATEMENTS) + r")\b", re.IGNORECASE)
BASH_START = re.compile(r"^(?:#![^\n]*|[A-Za-z_]\w*)")


class SchedulerJobResponse(BaseModel):
    id: uuid.UUID = Field(...)
    type: Literal[JobType.SQL, JobType.BASH]
    script: str = Field(...)
    cron: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)


class SchedulerJobCreate(BaseModel):
    type: Literal[JobType.SQL, JobType.BASH]
    script: str = Field(..., description="SQL or Shell script to run")
    cron: str = Field(..., description="Cron‐style schedule (e.g. '0 0 * * *')")

    @field_validator("cron")
    @classmethod
    def validate_crone(cls, expression: str) -> str:
        try:
            CronTrigger.from_crontab(expression)
        except ValueError as e:
            raise ValueError(f"Invalid cron expression: {expression!r}") from e
        return expression

    @field_validator("script")
    @classmethod
    def validate_script(cls, script: str, info: ValidationInfo) -> str:
        job_type = info.data.get("type")
        stripped = script.lstrip()

        if job_type == JobType.SQL:
            if not SQL_START.match(stripped):
                raise ValueError(f"Invalid SQL: must start with one of {VALID_STATEMENTS}")
        else:
            if not BASH_START.match(stripped):
                raise ValueError("Invalid Bash: must start with shebang (#!…) or a command name")
        return script


class SchedulerJobUpdate(BaseModel):
    type: Literal[JobType.SQL, JobType.BASH] | None = None
    script: str | None = Field(default=None, description="SQL or Shell script to run")
    cron: str | None = Field(default=None, description="Cron‐style schedule (e.g. '0 0 * * *')")

    @field_validator("cron")
    @classmethod
    def validate_crone(cls, expression: str | None) -> str | None:
        if expression is None:
            return None

        try:
            CronTrigger.from_crontab(expression)
        except ValueError as e:
            raise ValueError(f"Invalid cron expression: {expression!r}") from e
        return expression

    @field_validator("script")
    @classmethod
    def validate_script(cls, script: str | None, info: ValidationInfo) -> str | None:
        if script is None:
            return None

        job_type = info.data.get("type")
        stripped = script.lstrip()

        if job_type == JobType.SQL:
            if not SQL_START.match(stripped):
                raise ValueError(f"Invalid SQL: must start with one of {VALID_STATEMENTS}")
        elif job_type == JobType.BASH:
            if not BASH_START.match(stripped):
                raise ValueError("Invalid Bash: must start with shebang (#!…) or a command name")
        return script
