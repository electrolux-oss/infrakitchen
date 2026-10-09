import enum
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, UTC
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import JSON, UUID, BigInteger, DateTime, ForeignKey, Identity, Index, String, Text, func, text, ARRAY
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base
from core.constants.model import EventType
from core.users.model import User


class NotificationChannel(enum.Enum):
    SLACK = "SLACK"
    IN_APP = "IN_APP"


class Subscription(Base):
    __tablename__: str = "subscriptions"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user: Mapped[User] = relationship("User", lazy="raise")
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (
        Index("idx_subscriptions_lookup", "entity_type", "entity_id"),
        Index("unique_user_resource_subscription", "user_id", "entity_type", "entity_id", unique=True),
    )


class NotificationPreference(Base):
    __tablename__: str = "notification_preferences"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user: Mapped[User] = relationship("User", lazy="raise")
    event_type: Mapped[str] = mapped_column(String(150), nullable=False)
    channels: Mapped[list[str]] = mapped_column(
        ARRAY(SQLAlchemyEnum(NotificationChannel, name="notification_channel", native_enum=False)),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (Index("unique_user_event_preference", "user_id", "event_type", unique=True),)


class UserNotification(Base):
    """An in-app notification delivered to a user, kept for the notification inbox."""

    __tablename__: str = "user_notifications"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    event_type: Mapped[str] = mapped_column(String(150), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    entity_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String(16), nullable=False, default="info")
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        Index("ix_user_notifications_user_created", "user_id", "created_at"),
        Index("ix_user_notifications_unread", "user_id", postgresql_where=text("read_at IS NULL")),
        Index("ix_user_notifications_created", "created_at"),
    )


class SubscriptionDTO(BaseModel):
    id: uuid.UUID = Field(...)
    user_id: uuid.UUID | None = Field(...)
    entity_type: str = Field(...)
    entity_id: uuid.UUID | str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(from_attributes=True)


class NotificationPreferenceDTO(BaseModel):
    id: uuid.UUID = Field(...)
    user_id: uuid.UUID | None = Field(...)
    event_type: str = Field(...)
    channels: list[NotificationChannel] = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(from_attributes=True)


class UserNotificationDTO(BaseModel):
    id: uuid.UUID = Field(...)
    user_id: uuid.UUID = Field(...)
    event_type: str = Field(...)
    entity_type: str = Field(...)
    entity_id: uuid.UUID | None = Field(default=None)
    entity_name: str | None = Field(default=None)
    title: str | None = Field(default=None)
    message: str = Field(...)
    status: str = Field(default="info")
    read_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)

    model_config = ConfigDict(from_attributes=True)


@dataclass
class NotificationEvent:
    event_type: EventType
    entity_type: str
    title: str
    status: str  # "info", "warning", "error", "success"
    message: str
    entity_id: str | None = None
    entity_name: str | None = None
    metadata: dict[str, Any] | None = None

    def to_payload(self) -> dict[str, Any]:
        return asdict(self)


class OutboxStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"


FINISHED_OUTBOX_STATUSES = (OutboxStatus.DONE, OutboxStatus.FAILED)


class NotificationOutboxItem(Base):
    """A notification event waiting to be routed to its subscribers.

    Written after the triggering transaction commits and claimed by the API's
    notification dispatchers with ``FOR UPDATE SKIP LOCKED``, so an event is routed
    once across all replicas and retried if routing fails or the claimer dies.
    """

    __tablename__: str = "notification_outbox"
    __table_args__: tuple[Any, ...] = (
        Index("ix_notification_outbox_queued", "available_at", "seq", postgresql_where=text("status = 'queued'")),
        Index("ix_notification_outbox_status_locked_until", "status", "locked_until"),
    )

    seq: Mapped[int] = mapped_column(BigInteger, Identity(), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(16), default=OutboxStatus.QUEUED)
    attempts: Mapped[int] = mapped_column(default=0)
    max_attempts: Mapped[int] = mapped_column(default=5)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # Set on every claim; only the current claimer may finish the item
    claim_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
