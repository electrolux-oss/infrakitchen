from datetime import datetime, UTC
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field, model_validator

from application.secrets.schema import SecretShort
from application.source_codes.schema import SourceCodeShort
from application.integrations.schema import IntegrationShort
from application.types import IacToolType
from core.constants.model import ModelState, ModelStatus
from core.users.schema import UserShort
from ..storages.schema import StorageShort


class ExecutorShort(BaseModel):
    id: uuid.UUID = Field(...)

    name: str = Field(
        ...,
        frozen=True,
    )

    source_code: SourceCodeShort = Field(...)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "executor"


class ExecutorResponse(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
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
        ModelStatus.PENDING,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)

    creator: UserShort = Field()

    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")

    runtime: IacToolType = Field(default="tofu")
    command_args: str = Field(default="")

    source_code: SourceCodeShort | None = Field(...)
    source_code_version: str | None = Field(default=None, frozen=True)
    source_code_branch: str | None = Field(default=None, frozen=True)
    source_code_folder: str = Field(default="", frozen=True)

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
    labels: list[str] = Field(default_factory=list)
    revision_number: int = Field(default=1)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "executor"


class ExecutorCreate(BaseModel):
    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")

    runtime: IacToolType = Field(default="tofu")
    command_args: str = Field(default="")

    source_code_id: uuid.UUID = Field(..., frozen=True)

    source_code_version: str | None = Field(default=None, frozen=True)
    source_code_branch: str | None = Field(default=None, frozen=True)
    source_code_folder: str = Field(default="", frozen=True)

    integration_ids: list[uuid.UUID | IntegrationShort] = Field(
        default=[],
    )

    secret_ids: list[uuid.UUID] = Field(
        default=[],
    )

    storage_id: uuid.UUID | None = Field(
        default=None,
    )
    storage_path: str | None = Field(
        default=None,
    )
    labels: list[str] = Field(default_factory=list)


class ExecutorUpdate(BaseModel):
    description: str | None = Field(default=None)
    command_args: str | None = Field(default=None)
    integration_ids: list[uuid.UUID] | None = Field(
        default=None,
    )
    secret_ids: list[uuid.UUID] | None = Field(
        default=None,
    )
    source_code_id: uuid.UUID | None = Field(default=None)
    source_code_version: str | None = Field(default=None)
    source_code_branch: str | None = Field(default=None)
    source_code_folder: str | None = Field(default=None)
    labels: list[str] | None = Field(default=None)

    # critical change, as changing storage may cause issues with existing resources
    storage_id: uuid.UUID | StorageShort | None = Field(
        default=None,
    )
    storage_path: str | None = Field(
        default=None,
    )

    model_config = ConfigDict(
        from_attributes=True,
    )

    @model_validator(mode="before")
    @classmethod
    def at_least_one_field_present(cls, values):
        if not isinstance(values, dict):
            return values
        if not any(values.get(field) not in (None, [], "") for field in ExecutorUpdate.model_fields):
            raise ValueError("At least one field must be provided in Executor update.")
        return values
