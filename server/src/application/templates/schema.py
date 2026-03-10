from datetime import datetime
import re
from typing import Literal
import uuid
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator
from application.types import IntegrationProviderType
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class TemplateConfig(BaseModel):
    # Allow only one resource per integration, which is required for some templates to work properly.
    # If false, multiple resources can be used in the same integration
    one_resource_per_integration: list[IntegrationProviderType] = Field(default_factory=list)

    # Allowed integration types for this template. If empty, all integration types are allowed.
    allowed_provider_integration_types: list[IntegrationProviderType] = Field(default_factory=list)

    # Naming convention for resources created from this template. Can include placeholders for template variables
    # e.g. 'my-resource-{variable}'. If None, no naming convention is enforced.
    naming_convention: str | None = Field(
        default=None,
    )


class TemplateShort(BaseModel):
    id: uuid.UUID
    name: str
    cloud_resource_types: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "template"


class TemplateCreate(BaseModel):
    """
    Container for a single template record.
    """

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    template: str = Field(
        ...,
        frozen=True,
    )
    parents: list[uuid.UUID] = Field(
        default_factory=list,
    )
    children: list[uuid.UUID] = Field(
        default_factory=list,
    )
    cloud_resource_types: list[str] = Field(default_factory=list)
    configuration: TemplateConfig = Field(default_factory=TemplateConfig)
    labels: list[str] = Field(default_factory=list)
    abstract: bool = Field(default=False)

    model_config = ConfigDict(from_attributes=True)

    @field_validator("template")
    @classmethod
    def validate_template(cls, value: str) -> str:
        pattern = r"[a-zA-Z0-9_]+"
        if not re.fullmatch(pattern, value):
            raise ValueError(f"field has to match pattern {pattern}")
        return value.lower()


class TemplateUpdate(BaseModel):
    """
    Container for a single template record.
    """

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    parents: list[uuid.UUID] = Field(
        default_factory=list,
    )
    children: list[uuid.UUID] = Field(
        default_factory=list,
    )
    cloud_resource_types: list[str] = Field(default_factory=list)
    configuration: TemplateConfig = Field(default_factory=TemplateConfig)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(
        from_attributes=True,
    )


class TemplateResponse(BaseModel):
    """
    Container for a single template record.
    """

    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    abstract: bool = Field(default=False)
    revision_number: int = Field(default=1)
    creator: UserShort | None = Field(default=None)

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    template: str = Field(
        ...,
        frozen=True,
    )
    parents: list[TemplateShort] = Field(
        default_factory=list,
    )
    children: list[TemplateShort] = Field(
        default_factory=list,
    )
    cloud_resource_types: list[str] = Field(default_factory=list)
    configuration: TemplateConfig = Field(default_factory=TemplateConfig)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "template"


class TemplateTreeResponse(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    node_id: uuid.UUID
    children: list["TemplateTreeResponse"] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


TemplateTreeResponse.model_rebuild()
