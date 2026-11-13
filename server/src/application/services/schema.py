from datetime import datetime, UTC
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, computed_field, field_validator

from application.integrations.schema import IntegrationShort
from application.projects.schema import ProjectShort
from application.source_codes.repository import repository_key
from application.source_codes.schema import SourceCodeShort
from core.users.schema import UserShort


class ServiceShort(BaseModel):
    id: uuid.UUID
    name: str
    owners: list[UserShort] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "service"


def _validate_optional_uuid(value: str | None, info: ValidationInfo) -> str | None:
    if value is None or value == "":
        return value
    try:
        return str(uuid.UUID(str(value)))
    except ValueError:
        raise ValueError(f"{info.field_name} must be a valid UUID") from None


def _validate_repository_path(value: str | None) -> str | None:
    if value is None:
        return value
    value = value.strip()
    if not value or value.startswith("/") or ".." in value.split("/"):
        raise ValueError("Path must be relative to the repository root and must not contain '..'")
    return value


def _validate_repository_url(value: str | None) -> str | None:
    if value is None:
        return value
    value = value.strip()
    if value and repository_key(value) is None:
        raise ValueError(
            "Repository URL must be a git URL like https://github.com/org/repo or git@github.com:org/repo.git"
        )
    return value


IMAGE_REPOSITORY_RE = re.compile(r"^[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*(?:/[a-z0-9]+(?:(?:\.|_|__|-+)[a-z0-9]+)*)*$")


def validate_image_repository(value: str | None) -> str | None:
    if value is None:
        return value
    value = value.strip()
    if value and not IMAGE_REPOSITORY_RE.match(value):
        raise ValueError(
            "Image repository must be lowercase letters and digits separated by '.', '_', '-' or '/', e.g. team/api"
        )
    return value


class ServiceCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    project_id: uuid.UUID | None = Field(default=None)
    source_code_id: str | None = Field(default=None)
    # Alternative to source_code_id; imported if not known yet
    repository_url: str | None = Field(default=None)
    repository_integration_id: uuid.UUID | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)
    owners: list[uuid.UUID] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    _check_source_code_id = field_validator("source_code_id", mode="before")(_validate_optional_uuid)
    _check_repository_url = field_validator("repository_url", mode="before")(_validate_repository_url)


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    project_id: uuid.UUID | None = Field(default=None)
    repository_url: str | None = Field(default=None)
    repository_integration_id: uuid.UUID | None = Field(default=None)
    registry_integration_id: str | None = Field(default=None)
    image_repository: str | None = Field(default=None)
    dockerfile_path: str | None = Field(default=None)
    build_context: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    owners: list[uuid.UUID] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    _check_uuids = field_validator("registry_integration_id", mode="before")(_validate_optional_uuid)
    _check_repository_url = field_validator("repository_url", mode="before")(_validate_repository_url)
    _check_paths = field_validator("dockerfile_path", "build_context", mode="before")(_validate_repository_path)
    _check_image_repository = field_validator("image_repository", mode="before")(validate_image_repository)


class ServiceResponse(BaseModel):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    revision_number: int = Field(default=1)
    creator: UserShort | None = Field(default=None)

    name: str = Field(...)
    description: str = Field(default="")
    project_id: uuid.UUID | None = Field(default=None)
    project: ProjectShort | None = Field(default=None)
    source_code_id: uuid.UUID | None = Field(default=None)
    source_code: SourceCodeShort | None = Field(default=None)
    registry_integration_id: uuid.UUID | None = Field(default=None)
    registry_integration: IntegrationShort | None = Field(default=None)
    image_repository: str | None = Field(default=None)
    dockerfile_path: str = Field(default="Dockerfile")
    build_context: str = Field(default=".")
    owners: list[UserShort] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "service"
