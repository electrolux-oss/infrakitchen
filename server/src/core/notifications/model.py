import enum
import uuid
from datetime import datetime, UTC

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, DateTime, ForeignKey, Index, String, func, ARRAY
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base
from core.users.model import User


class NotificationChannel(enum.Enum):
    SLACK = "SLACK"
    IN_APP = "IN_APP"


class Subscription(Base):
    __tablename__: str = "subscriptions"

    user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    user: Mapped[User] = relationship("User", lazy="noload")
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
    user: Mapped[User] = relationship("User", lazy="noload")
    event_type: Mapped[str] = mapped_column(String(150), nullable=False)
    channels: Mapped[list[str]] = mapped_column(
        ARRAY(SQLAlchemyEnum(NotificationChannel, name="notification_channel", native_enum=False)),
        nullable=False,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (Index("unique_user_event_preference", "user_id", "event_type", unique=True),)


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
