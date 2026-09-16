from datetime import datetime, UTC
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from application.projects.schema import ProjectShort
from core.users.schema import UserShort


class ServiceShort(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str | None = Field(default=None)
    owners: list[UserShort] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "service"


def _validate_repository_url(value: str | None) -> str | None:
    # An empty string is how clients clear the link on update.
    if value is None or value == "":
        return value
    value = value.strip()
    if not value.startswith(("https://", "http://")):
        raise ValueError("Repository URL must start with https:// or http://")
    return value


class ServiceCreate(BaseModel):
    name: str = Field(...)
    display_name: str | None = Field(default=None)
    description: str = Field(default="")
    project_id: uuid.UUID = Field(...)
    repository_url: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)
    owners: list[uuid.UUID] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    _check_repository_url = field_validator("repository_url")(_validate_repository_url)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None)
    display_name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    project_id: uuid.UUID | None = Field(default=None)
    repository_url: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    owners: list[uuid.UUID] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    _check_repository_url = field_validator("repository_url")(_validate_repository_url)


class ServiceResponse(BaseModel):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    revision_number: int = Field(default=1)
    creator: UserShort | None = Field(default=None)

    name: str = Field(...)
    display_name: str | None = Field(default=None)
    description: str = Field(default="")
    project_id: uuid.UUID = Field(...)
    project: ProjectShort | None = Field(default=None)
    repository_url: str | None = Field(default=None)
    owners: list[UserShort] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "service"
