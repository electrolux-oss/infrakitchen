from datetime import datetime, UTC
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, DateTime, ForeignKey, JSON, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from core.base_models import BaseEntity
from core.constants.model import ModelStatus
from core.users.model import User, UserDTO

from .schema import WorkerProviderConfig, WorkerProviderType


class WorkerTemplate(BaseEntity):
    """Describes how to spawn task workers on demand with a worker provider (e.g. a Kubernetes pod)."""

    __tablename__: str = "worker_templates"

    name: Mapped[str] = mapped_column(unique=True)
    description: Mapped[str] = mapped_column(default="")
    provider: Mapped[str] = mapped_column()
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    max_workers: Mapped[int] = mapped_column(default=3)
    idle_timeout_seconds: Mapped[int] = mapped_column(default=300)
    priority: Mapped[int] = mapped_column(default=0)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    creator: Mapped[User] = relationship("User", lazy="joined")

    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.ENABLED,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class WorkerTemplateDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(...)
    description: str = Field(default="")
    provider: WorkerProviderType = Field(..., frozen=True)
    configuration: WorkerProviderConfig = Field(...)
    max_workers: int = Field(default=3)
    idle_timeout_seconds: int = Field(default=300)
    priority: int = Field(default=0)
    last_error: str | None = Field(default=None)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
