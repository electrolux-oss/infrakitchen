from datetime import datetime
from typing import Any, Literal, TypeVar
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from application.secrets.schema import SecretShort
from application.templates.schema import TemplateShort
from application.integrations.schema import IntegrationShort
from application.source_code_versions.schema import SourceCodeVersionShort
from application.workspaces.schema import WorkspaceShort
from core.constants.model import ModelState, ModelStatus
from core.users.schema import UserShort
from ..storages.schema import StorageShort


class DependencyTag(BaseModel):
    """
    Used for tagging resources in cloud providers
    """

    name: str = Field(..., frozen=True)
    value: str = Field(..., frozen=True)
    inherited_by_children: bool = Field(default=False)


class DependencyConfig(BaseModel):
    """
    Used for sharing configs to children
    """

    name: str = Field(..., frozen=True)
    value: str = Field(..., frozen=True)
    inherited_by_children: bool = Field(default=False)


class Outputs(BaseModel):
    """
    Used for getting outputs from automation
    """

    name: str = Field(..., frozen=True)
    value: Any = Field(..., frozen=True)
    sensitive: bool = Field(default=False)


class Variables(BaseModel):
    """
    Used for setting variables for automation
    """

    name: str = Field(...)
    value: Any = Field(...)
    sensitive: bool = Field(default=False)
    type: str = Field(default="any")
    description: str = Field(default="")


DependencyType = TypeVar("DependencyType", DependencyTag, DependencyConfig)


class ResourceShort(BaseModel):
    id: uuid.UUID = Field(...)

    name: str = Field(
        ...,
        frozen=True,
    )

    template: TemplateShort = Field(...)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "resource"


class ResourceResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    state: Literal[
        ModelState.PROVISIONED,
        ModelState.PROVISION,
        ModelState.DESTROY,
        ModelState.DESTROYED,
    ] = Field(default=ModelState.PROVISION)
    status: Literal[
        ModelStatus.QUEUED,
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.UNKNOWN,
        ModelStatus.APPROVAL_PENDING,
        ModelStatus.PENDING,
        ModelStatus.REJECTED,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)

    abstract: bool = Field(default=False)
    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")
    template: TemplateShort = Field(...)

    source_code_version: SourceCodeVersionShort | None = Field(...)
    integration_ids: list[IntegrationShort] = Field(
        default=[],
    )

    secret_ids: list[SecretShort] = Field(
        default=[],
    )

    storage: StorageShort | None = Field(...)
    storage_path: str | None = Field(
        default=None,
    )
    variables: list[Variables] = Field(default=[])
    outputs: list[Outputs] = Field(default=[])
    dependency_tags: list[DependencyTag] = Field(default_factory=list)
    dependency_config: list[DependencyConfig] = Field(default_factory=list)
    parents: list[ResourceShort] = Field(
        default_factory=list,
    )
    children: list[ResourceShort] = Field(
        default_factory=list,
    )
    labels: list[str] = Field(default_factory=list)
    workspace: WorkspaceShort | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "resource"


class ResourceCreate(BaseModel):
    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")
    template_id: uuid.UUID = Field(..., frozen=True)

    source_code_version_id: uuid.UUID | None = Field(
        default=None,
    )
    integration_ids: list[uuid.UUID | IntegrationShort] = Field(
        default=[],
    )

    secret_ids: list[uuid.UUID] = Field(
        default=[],
    )

    storage_id: uuid.UUID | StorageShort | None = Field(
        default=None,
    )
    storage_path: str | None = Field(
        default=None,
    )
    variables: list[Variables] = Field(default=[])
    dependency_tags: list[DependencyTag] = Field(default_factory=list)
    dependency_config: list[DependencyConfig] = Field(default_factory=list)
    parents: list[uuid.UUID] = Field(
        default_factory=list,
    )
    children: list[uuid.UUID] = Field(
        default_factory=list,
    )
    labels: list[str] = Field(default_factory=list)
    workspace_id: uuid.UUID | None = Field(
        default=None,
    )


class ResourcePatch(BaseModel):
    description: str | None = Field(default="")
    source_code_version_id: uuid.UUID | None = Field(
        default=None,
    )
    integration_ids: list[uuid.UUID] | None = Field(
        default=[],
    )
    secret_ids: list[uuid.UUID] | None = Field(
        default=[],
    )
    variables: list[Variables] | None = Field(default=[])
    dependency_tags: list[DependencyTag] | None = Field(default_factory=list)
    dependency_config: list[DependencyConfig] | None = Field(default_factory=list)
    labels: list[str] | None = Field(default_factory=list)
    workspace_id: uuid.UUID | None = Field(
        default=None,
    )

    @model_validator(mode="before")
    def at_least_one_field_present(cls, values):
        fields = [
            "description",
            "source_code_version_id",
            "integration_ids",
            "secret_ids",
            "variables",
            "dependency_tags",
            "dependency_config",
            "labels",
            "workspace_id",
        ]
        if not any(values.get(field) not in (None, [], "") for field in fields):
            raise ValueError("At least one field must be provided in ResourcePatch.")
        return values


class ResourceWithConfigs(BaseModel):
    """
    Used for getting resource with configs to setup new children resources
    """

    id: uuid.UUID
    name: str
    template_id: uuid.UUID
    source_code_version_id: uuid.UUID | None
    integration_ids: list[uuid.UUID | IntegrationShort]
    variables: list[Variables]
    dependency_tags: list[DependencyTag]
    dependency_config: list[DependencyConfig]
    outputs: list[Outputs]
    model_config = ConfigDict(from_attributes=True)


class ResourceVariableSchema(BaseModel):
    """
    Used for getting resource with configs to setup new children resources
    """

    name: str
    type: str
    description: str | None = Field(default=None)
    options: list[str] = Field(default_factory=list)
    required: bool = Field(default=False)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    sensitive: bool = Field(default=False)
    restricted: bool = Field(default=False)
    value: Any | None = Field(default=None)
    index: int = Field(default=0)


class ResourceTreeResponse(BaseModel):
    id: uuid.UUID
    name: str
    state: str
    status: str
    template_name: str
    node_id: uuid.UUID
    children: list["ResourceTreeResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


ResourceTreeResponse.model_rebuild()


class RoleResourcesResponse(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    resource_name: str
    role: str
    action: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class UserResourceResponse(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    resource_name: str
    action: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
