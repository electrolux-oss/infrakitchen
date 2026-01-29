from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.secrets.schema import SecretShort
from application.source_codes.schema import SourceCodeShort
from application.integrations.schema import IntegrationShort
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
        ModelStatus.PENDING,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)

    creator: UserShort = Field()

    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")

    runtime: Literal["opentofu"] = Field(default="opentofu")
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

    runtime: Literal["opentofu"] = Field(default="opentofu")
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
    description: str | None = Field(default="")
    command_args: str = Field(default="")
    integration_ids: list[uuid.UUID] = Field(
        default=[],
    )
    secret_ids: list[uuid.UUID] = Field(
        default=[],
    )
    source_code_id: uuid.UUID = Field(...)
    source_code_version: str | None = Field(default=None)
    source_code_branch: str | None = Field(default=None)
    source_code_folder: str = Field(...)
    labels: list[str] = Field(default_factory=list)


class RoleExecutorsResponse(BaseModel):
    id: uuid.UUID
    executor_id: uuid.UUID
    executor_name: str
    role: str
    action: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )


class UserExecutorResponse(BaseModel):
    id: uuid.UUID
    executor_id: uuid.UUID
    executor_name: str
    action: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(
        from_attributes=True,
    )
