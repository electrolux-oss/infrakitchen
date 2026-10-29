import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import JSON, UUID, Boolean, DateTime, ForeignKey, Index, Integer, func
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base
from core.constants.model import DriftStatus


class ResourceDrift(Base):
    """Result of the last drift check of a resource; a resource that was never checked has no row."""

    __tablename__: str = "resource_drifts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resources.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[DriftStatus] = mapped_column(
        SQLAlchemyEnum(DriftStatus, name="drift_status", native_enum=False),
        nullable=False,
        default=DriftStatus.UNKNOWN,
    )
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (
        Index("ix_resource_drifts_resource_id", "resource_id", unique=True),
        Index("ix_resource_drifts_status", "status"),
        Index("ix_resource_drifts_checked_at", "checked_at"),
    )


class ResourceDriftDTO(BaseModel):
    id: uuid.UUID
    resource_id: uuid.UUID
    status: DriftStatus
    checked_at: datetime
    summary: dict[str, Any] | None = None

    model_config = ConfigDict(from_attributes=True)


DEFAULT_DRIFT_INTERVAL_HOURS = 24
DEFAULT_DRIFT_BATCH_SIZE = 20


class DriftSettings(Base):
    """Global drift detection configuration; a single row that is created on the first save."""

    __tablename__: str = "drift_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    interval_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=DEFAULT_DRIFT_INTERVAL_HOURS)
    # resources queued per scheduler run, spreads the checks over the workers
    batch_size: Mapped[int] = mapped_column(Integer, nullable=False, default=DEFAULT_DRIFT_BATCH_SIZE)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class DriftSettingsDTO(BaseModel):
    enabled: bool = False
    interval_hours: int = Field(default=DEFAULT_DRIFT_INTERVAL_HOURS, ge=1, le=24 * 365)
    batch_size: int = Field(default=DEFAULT_DRIFT_BATCH_SIZE, ge=1, le=1000)

    model_config = ConfigDict(from_attributes=True)
