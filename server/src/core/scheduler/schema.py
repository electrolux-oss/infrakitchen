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
    def validate_crone(cls, expression: str) -> str:
        try:
            CronTrigger.from_crontab(expression)
        except ValueError as e:
            raise ValueError(f"Invalid cron expression: {expression!r}") from e
        return expression

    @field_validator("script")
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
