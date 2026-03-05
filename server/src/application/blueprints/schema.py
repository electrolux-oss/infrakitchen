from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.templates.schema import TemplateShort
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class WiringRule(BaseModel):
    """
    Defines how an output from one template's resource feeds into
    a variable of another template's resource.
    """

    source_template_id: uuid.UUID = Field(..., description="Template whose resource produces the output")
    source_output: str = Field(..., description="Name of the output variable on the source resource")
    target_template_id: uuid.UUID = Field(..., description="Template whose resource consumes the value")
    target_variable: str = Field(..., description="Name of the input variable on the target resource")


class BlueprintCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    template_ids: list[uuid.UUID] = Field(
        ...,
        min_length=1,
        description="Ordered list of template IDs to include in the blueprint",
    )
    wiring: list[WiringRule] = Field(default_factory=list)
    default_variables: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Per-template default variable overrides keyed by template_id",
    )
    configuration: dict[str, Any] = Field(default_factory=dict)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class BlueprintUpdate(BaseModel):
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)
    template_ids: list[uuid.UUID] | None = Field(default=None)
    wiring: list[WiringRule] | None = Field(default=None)
    default_variables: dict[str, dict[str, Any]] | None = Field(default=None)
    configuration: dict[str, Any] | None = Field(default=None)
    labels: list[str] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class BlueprintShort(BaseModel):
    id: uuid.UUID
    name: str

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "blueprint"


class BlueprintResponse(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    description: str = Field(default="")

    templates: list[TemplateShort] = Field(default_factory=list)
    wiring: list[WiringRule] = Field(default_factory=list)
    default_variables: dict[str, dict[str, Any]] = Field(default_factory=dict)
    configuration: dict[str, Any] = Field(default_factory=dict)
    labels: list[str] = Field(default_factory=list)

    status: ModelStatus = Field(default=ModelStatus.ENABLED)
    revision_number: int = Field(default=1)
    created_by: UserShort | uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "blueprint"
