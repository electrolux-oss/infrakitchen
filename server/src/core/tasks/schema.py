from datetime import UTC, datetime
import uuid
from typing import Literal, Self
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from apscheduler.triggers.cron import CronTrigger
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from core.constants.model import ModelActions, ModelState, ModelStatus
from core.users.model import UserDTO


class TaskEntityResponse(BaseModel):
    id: uuid.UUID = Field(...)
    entity_id: str | uuid.UUID = Field(...)
    entity: str = Field(...)
    state: (
        Literal[
            ModelState.PROVISIONED,
            ModelState.PROVISION,
            ModelState.DESTROY,
            ModelState.DESTROYED,
        ]
        | None
    ) = Field(default=None)
    status: Literal[
        ModelStatus.QUEUED,
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.CANCELLED,
        ModelStatus.UNKNOWN,
        ModelStatus.APPROVAL_PENDING,
        ModelStatus.PENDING,
        ModelStatus.REJECTED,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)
    action: ModelActions | None = Field(default=None)
    run_at: datetime | None = Field(default=None)
    cron: str | None = Field(default=None)
    timezone: str | None = Field(default=None)
    error: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by: UserDTO | uuid.UUID = Field()

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return self.entity


class TaskScheduleCreate(BaseModel):
    entity_id: uuid.UUID
    entity: str = Field(default="resource", validation_alias=AliasChoices("entity", "entity_type"))
    action: ModelActions = Field(description="Entity action to execute later")
    run_at: datetime | None = Field(default=None, description="One-time run date")
    cron: str | None = Field(default=None, description="Cron-style schedule for recurring runs (e.g. '0 2 * * *')")
    timezone: str = Field(default="UTC", description="IANA time zone the cron expression is evaluated in")

    @field_validator("entity")
    @classmethod
    def validate_entity(cls, value: str) -> str:
        if value not in {"resource", "executor"}:
            raise ValueError("Only resource or executor entities can be scheduled")
        return value

    @field_validator("action")
    @classmethod
    def validate_action(cls, value: ModelActions) -> ModelActions:
        if value != ModelActions.EXECUTE:
            raise ValueError("Only execute action can be scheduled")
        return value

    @field_validator("run_at")
    @classmethod
    def validate_run_at(cls, value: datetime | None) -> datetime | None:
        if value is None:
            return None
        normalized = value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
        if normalized <= datetime.now(UTC):
            raise ValueError("Scheduled time must be in the future")
        return normalized

    @field_validator("cron")
    @classmethod
    def validate_cron(cls, value: str | None) -> str | None:
        if value is None:
            return None
        value = value.strip()
        try:
            CronTrigger.from_crontab(value)
        except ValueError as e:
            raise ValueError(f"Invalid cron expression: {value!r}") from e
        return value

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError) as e:
            raise ValueError(f"Invalid time zone: {value!r}") from e
        return value

    @model_validator(mode="after")
    def validate_schedule(self) -> Self:
        if (self.run_at is None) == (self.cron is None):
            raise ValueError("Exactly one of run_at or cron must be provided")
        return self
