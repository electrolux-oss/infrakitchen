from datetime import datetime
import re
from typing import Literal
import uuid
from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator
from core.constants.model import ModelStatus
from core.users.schema import UserShort


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
