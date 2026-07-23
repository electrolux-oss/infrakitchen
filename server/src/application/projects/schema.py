from datetime import datetime, UTC
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.common.schema import DependencyConfig, DependencyTag
from application.workspaces.schema import WorkspaceShort
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class ProjectConfig(BaseModel):
    always_use_workspace: bool = Field(default=False)


class ProjectShort(BaseModel):
    id: uuid.UUID
    name: str
    status: str = Field(default=ModelStatus.ENABLED)
    owners: list[UserShort] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "project"


class ProjectCreate(BaseModel):
    """Create a new project."""

    name: str = Field(...)
    description: str = Field(default="")
    workspace_id: uuid.UUID | None = Field(default=None)
    configuration: ProjectConfig = Field(default_factory=ProjectConfig)
    dependency_tags: list[DependencyTag] = Field(default_factory=list)
    dependency_config: list[DependencyConfig] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    owners: list[uuid.UUID] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class ProjectUpdate(BaseModel):
    """Update an existing project."""

    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    workspace_id: uuid.UUID | None = Field(default=None)
    configuration: ProjectConfig | None = Field(default=None)
    dependency_tags: list[DependencyTag] | None = Field(default=None)
    dependency_config: list[DependencyConfig] | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    owners: list[uuid.UUID] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class ProjectResponse(BaseModel):
    """Full project response."""

    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    creator: UserShort | None = Field(default=None)

    name: str = Field(...)
    description: str = Field(default="")
    workspace_id: uuid.UUID | None = Field(default=None)
    configuration: ProjectConfig = Field(default_factory=ProjectConfig)
    workspace: WorkspaceShort | None = Field(default=None)
    owners: list[UserShort] = Field(default_factory=list)
    dependency_tags: list[DependencyTag] = Field(default_factory=list)
    dependency_config: list[DependencyConfig] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "project"
