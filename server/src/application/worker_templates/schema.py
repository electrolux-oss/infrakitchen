from datetime import datetime, UTC
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from core.constants.model import ModelStatus
from core.users.schema import UserShort

from .functions import parse_pod_manifest

WorkerProviderType = Literal["kubernetes"]


class KubernetesWorkerConfig(BaseModel):
    provider: Literal["kubernetes"] = Field(default="kubernetes", frozen=True)
    pod_manifest: str = Field(..., description="Pod manifest (YAML) used to spawn a worker")
    namespace: str | None = Field(default=None, description="Defaults to the namespace InfraKitchen runs in")

    @field_validator("pod_manifest")
    @classmethod
    def validate_pod_manifest(cls, value: str) -> str:
        parse_pod_manifest(value)
        return value


# Add new provider configs here as a union with Field(discriminator="provider")
WorkerProviderConfig = KubernetesWorkerConfig


class WorkerTemplateShort(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    status: str = Field(default=ModelStatus.ENABLED)
    is_default: bool = Field(default=False)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "worker_template"


class WorkerTemplateResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    status: Literal[
        ModelStatus.DISABLED,
        ModelStatus.ENABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    creator: UserShort = Field()

    name: str = Field(...)
    description: str = Field(default="")
    provider: WorkerProviderType = Field(..., frozen=True)
    configuration: WorkerProviderConfig = Field(...)
    max_workers: int = Field(default=3)
    idle_timeout_seconds: int = Field(default=300)
    is_default: bool = Field(default=False)
    last_error: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "worker_template"


class WorkerTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1)
    description: str = Field(default="")
    provider: WorkerProviderType = Field(..., frozen=True)
    configuration: WorkerProviderConfig = Field(...)
    max_workers: int = Field(default=3, ge=1)
    idle_timeout_seconds: int = Field(default=300, ge=30)
    labels: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def provider_matches_configuration(self):
        if self.configuration.provider != self.provider:
            raise ValueError("Configuration does not match the worker provider")
        return self


class WorkerTemplateUpdate(BaseModel):
    description: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)
    configuration: WorkerProviderConfig | None = Field(default=None)
    max_workers: int | None = Field(default=None, ge=1)
    idle_timeout_seconds: int | None = Field(default=None, ge=30)

    @model_validator(mode="before")
    @classmethod
    def at_least_one_field_present(cls, values):
        if not isinstance(values, dict):
            return values
        if not any(values.get(field) not in (None, [], "") for field in WorkerTemplateUpdate.model_fields):
            raise ValueError("At least one field must be provided in Worker template update.")
        return values
