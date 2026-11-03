import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import JSON, UUID, Boolean, DateTime, ForeignKey, Index, Integer, Text, func
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base
from core.constants.model import DriftStatus


class ResourceDrift(Base):
    """
    Drift of a resource: what the next apply would change, as found by its last successful check (or
    nothing after a successful apply), and the checks that failed after it. A failed check keeps the result,
    as it can't tell whether the resource drifted. A resource that was never checked has no row.
    """

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
    # when the result was found: the last successful check, or a successful apply after it; while no check
    # succeeded yet, when the first one failed. The next scheduled check is due an interval after it
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=func.now())
    # when the current drift was first found; cleared when the resource is in sync again
    first_detected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    summary: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    # drift keys of the last successful check (see tf_drift.DriftResult.keys); failed checks and failed
    # applies keep them, so the same drift is not notified twice. Internal, never sent to the UI
    known_drift: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    # checks that failed in a row since the last successful check or apply; the scheduler backs off on them
    consecutive_failures: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    # why the last check failed and when; set only while consecutive_failures > 0
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_error_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        Index("ix_resource_drifts_resource_id", "resource_id", unique=True),
        Index("ix_resource_drifts_status", "status"),
        Index("ix_resource_drifts_checked_at", "checked_at"),
    )


DEFAULT_DRIFT_INTERVAL_HOURS = 24
# drift settings are a single row, saved under this id
DRIFT_SETTINGS_ID = uuid.UUID(int=1)


class DriftSettings(Base):
    """Global drift detection configuration; a single row that is created on the first save."""

    __tablename__: str = "drift_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    interval_hours: Mapped[int] = mapped_column(Integer, nullable=False, default=DEFAULT_DRIFT_INTERVAL_HOURS)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class DriftSettingsDTO(BaseModel):
    enabled: bool = False
    interval_hours: int = Field(default=DEFAULT_DRIFT_INTERVAL_HOURS, ge=1, le=24 * 365)

    model_config = ConfigDict(from_attributes=True)
