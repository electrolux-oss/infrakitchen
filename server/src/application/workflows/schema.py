from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.integrations.schema import IntegrationShort
from application.resources.schema import ResourceShort
from application.secrets.schema import SecretShort
from application.source_code_versions.schema import SourceCodeVersionShort
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


class WorkflowRequest(BaseModel):
    variable_overrides: dict[str, dict[str, Any]] = Field(
        default_factory=dict,
        description="Per-template variable overrides keyed by template_id",
    )
    workspace_id: uuid.UUID | None = Field(
        default=None,
        description="Workspace to create resources in",
    )
    integration_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Cloud integration IDs shared across all resources",
    )
    storage_id: uuid.UUID | None = Field(
        default=None,
        description="Storage ID for TF state",
    )
    secret_ids: list[uuid.UUID] = Field(
        default_factory=list,
        description="Secret IDs shared across all resources",
    )
    source_code_version_overrides: dict[str, uuid.UUID] = Field(
        default_factory=dict,
        description="Per-template source code version overrides keyed by template_id",
    )
    parent_overrides: dict[str, list[uuid.UUID]] = Field(
        default_factory=dict,
        description="Per-template parent resource IDs for templates with external parents",
    )


class WorkflowStepCreate(BaseModel):
    template_id: uuid.UUID
    position: int
    status: str = ModelStatus.PENDING
    resolved_variables: dict[str, Any] = Field(default_factory=dict)
    parent_resource_ids: list[uuid.UUID] = Field(default_factory=list)
    source_code_version_id: uuid.UUID | None = None
    integration_ids: list[uuid.UUID] = Field(default_factory=list)
    secret_ids: list[uuid.UUID] = Field(default_factory=list)
    storage_id: uuid.UUID | None = None


class WorkflowCreate(BaseModel):
    wiring_snapshot: list[WiringRule] = Field(default_factory=list)
    variable_overrides: dict[str, Any] = Field(default_factory=dict)
    status: str = ModelStatus.PENDING
    created_by: uuid.UUID
    steps: list[WorkflowStepCreate] = Field(default_factory=list)


class WorkflowStepResponse(BaseModel):
    id: uuid.UUID
    template_id: uuid.UUID
    template: TemplateShort | None = None
    resource_id: uuid.UUID | None = None
    resource: ResourceShort | None = None
    position: int
    status: str
    error_message: str | None = None
    resolved_variables: dict[str, Any] = Field(default_factory=dict)
    parent_resource_ids: list[uuid.UUID] = Field(default_factory=list)
    parent_resources: list[ResourceShort] = Field(default_factory=list)
    integration_ids: list[IntegrationShort] = Field(default_factory=list)
    secret_ids: list[SecretShort] = Field(default_factory=list)
    source_code_version_id: uuid.UUID | None = None
    source_code_version: SourceCodeVersionShort | None = None
    storage_id: uuid.UUID | None = None
    started_at: datetime | None = None
    completed_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class WorkflowResponse(BaseModel):
    id: uuid.UUID
    status: str
    error_message: str | None = None
    steps: list[WorkflowStepResponse] = Field(default_factory=list)
    wiring_snapshot: list[WiringRule] = Field(default_factory=list)
    variable_overrides: dict[str, Any] = Field(default_factory=dict)
    creator: UserShort | None = Field(default=None)
    started_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "workflow"
