from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.secrets.model import Secret, SecretDTO
from application.source_codes.model import SourceCode, SourceCodeDTO
from application.integrations.model import Integration, IntegrationDTO
from core.base_models import Base, BaseEntity
from core.constants.model import ModelState, ModelStatus
from core.users.model import User, UserDTO
from ..storages.model import Storage, StorageDTO

from sqlalchemy import UUID, ForeignKey, Table
from sqlalchemy import Column, JSON


executor_integrations = Table(
    "executor_integrations",
    Base.metadata,
    Column("executor_id", ForeignKey("executors.id", ondelete="CASCADE"), primary_key=True),
    Column("integration_id", ForeignKey("integrations.id", ondelete="CASCADE"), primary_key=True),
)

executor_secrets = Table(
    "executor_secrets",
    Base.metadata,
    Column("executor_id", ForeignKey("executors.id", ondelete="CASCADE"), primary_key=True),
    Column("secret_id", ForeignKey("secrets.id", ondelete="CASCADE"), primary_key=True),
)


class Executor(BaseEntity):
    __tablename__: str = "executors"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(unique=True, index=True, nullable=False)
    description: Mapped[str] = mapped_column(default="")

    runtime: Mapped[Literal["opentofu"]] = mapped_column(default="opentofu")
    command_args: Mapped[str] = mapped_column(default="")

    source_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_codes.id", ondelete="CASCADE")
    )
    source_code: Mapped[SourceCode] = relationship("SourceCode", lazy="joined")
    source_code_version: Mapped[str | None] = mapped_column()
    source_code_branch: Mapped[str | None] = mapped_column()
    source_code_folder: Mapped[str] = mapped_column(default="")

    integration_ids: Mapped[list[Integration]] = relationship(secondary=executor_integrations)
    secret_ids: Mapped[list[Secret]] = relationship(secondary=executor_secrets)

    storage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("storages.id"), nullable=True)
    storage: Mapped[Storage] = relationship("Storage", lazy="joined")
    storage_path: Mapped[str | None] = mapped_column(nullable=True)

    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    creator: Mapped[User] = relationship("User", lazy="joined")
    state: Mapped[ModelState] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=False, default=ModelState.PROVISION
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.QUEUED,
    )


class ExecutorDTO(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")

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

    runtime: Literal["opentofu"] = Field(default="opentofu")
    command_args: str = Field(default="")
    source_code_id: uuid.UUID | SourceCodeDTO | None = Field(...)
    source_code_version: str | None = Field(default=None)
    source_code_branch: str | None = Field(default=None)
    source_code_folder: str = Field(default="")
    integration_ids: list[uuid.UUID | IntegrationDTO] = Field(default_factory=list)
    secret_ids: list[uuid.UUID | SecretDTO] = Field(default_factory=list)
    storage_id: uuid.UUID | StorageDTO | None = Field(default=None)
    storage_path: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)
    revision_number: int = Field(default=1)

    created_by: UserDTO | uuid.UUID = Field()

    model_config = ConfigDict(from_attributes=True)
