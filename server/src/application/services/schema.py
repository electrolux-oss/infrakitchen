from datetime import datetime, UTC
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, ValidationInfo, computed_field, field_validator

from application.projects.schema import ProjectShort
from application.resources.schema import ResourceShort
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


VERSION_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")


def _validate_version(value: str | None) -> str | None:
    if value is None:
        return value
    value = value.strip()
    if value and not VERSION_RE.match(value):
        raise ValueError(
            "Version must be a valid image tag: letters, digits, '_', '.' and '-', "
            "not starting with '.' or '-', at most 128 characters"
        )
    return value


class ServiceCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    project_id: uuid.UUID = Field(...)
    source_code_id: str | None = Field(default=None)
    # Alternative to source_code_id; imported if not known yet
    repository_url: str | None = Field(default=None)
    repository_integration_id: uuid.UUID | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)
    owners: list[uuid.UUID] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    _check_source_code_id = field_validator("source_code_id", mode="before")(_validate_optional_uuid)

    @field_validator("repository_url", mode="before")
    @classmethod
    def _check_repository_url(cls, value: str | None) -> str | None:
        if value is None or not value.strip():
            return None
        value = value.strip()
        if repository_key(value) is None:
            raise ValueError(
                "Repository URL must be a git URL like https://github.com/org/repo or git@github.com:org/repo.git"
            )
        return value


class ServiceUpdate(BaseModel):
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    version: str | None = Field(default=None)
    project_id: uuid.UUID | None = Field(default=None)
    source_code_id: str | None = Field(default=None)
    image_resource_id: str | None = Field(default=None)
    dockerfile_path: str | None = Field(default=None)
    build_context: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    owners: list[uuid.UUID] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    _check_uuids = field_validator("source_code_id", "image_resource_id", mode="before")(_validate_optional_uuid)
    _check_paths = field_validator("dockerfile_path", "build_context", mode="before")(_validate_repository_path)
    _check_version = field_validator("version", mode="before")(_validate_version)


class ServiceResponse(BaseModel):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    revision_number: int = Field(default=1)
    creator: UserShort | None = Field(default=None)

    name: str = Field(...)
    description: str = Field(default="")
    version: str | None = Field(default=None)
    project_id: uuid.UUID = Field(...)
    project: ProjectShort | None = Field(default=None)
    source_code_id: uuid.UUID | None = Field(default=None)
    source_code: SourceCodeShort | None = Field(default=None)
    image_resource_id: uuid.UUID | None = Field(default=None)
    image_resource: ResourceShort | None = Field(default=None)
    dockerfile_path: str = Field(default="Dockerfile")
    build_context: str = Field(default=".")
    owners: list[UserShort] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "service"
