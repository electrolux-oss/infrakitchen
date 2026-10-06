import uuid
from pydantic import Field
from pydantic import BaseModel as PydanticBaseModel
from datetime import datetime

from sqlalchemy import UUID, DateTime, ForeignKey, func
from sqlalchemy.ext.asyncio import AsyncAttrs

from typing import Any, Literal

from .constants import ModelState, ModelStatus
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import Enum as SQLAlchemyEnum


class Base(AsyncAttrs, DeclarativeBase):
    __abstract__: bool = True
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)


class BaseRevision(Base):
    __abstract__: bool = True
    revision_number: Mapped[int] = mapped_column(default=1)


class BaseState(Base):
    __abstract__: bool = True
    state: Mapped[ModelState] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=False, default=ModelState.PROVISION
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.QUEUED,
    )


class BaseEntity(BaseRevision, BaseState):
    __abstract__: bool = True

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class BaseModel(PydanticBaseModel):
    id: uuid.UUID | None = Field(default=None)


class PatchBodyModel(PydanticBaseModel):
    action: str


class MessageModel(PydanticBaseModel):
    """A pubsub message: ``body`` plus ``_metadata``, published to ``topic`` (see ``core.pubsub``)."""

    body: dict[str, Any] = Field(default_factory=dict)
    message_type: Literal[
        "user",
        "notification",
        "log",
        "broadcast",
        "task",
        "event",
    ] = Field(default="user")
    topic: str = Field(default="")
    metadata: dict[str, Any] = Field(default_factory=dict)

    def to_data(self) -> dict[str, Any]:
        return {**self.body, "_metadata": {**self.metadata, "_message_type": self.message_type}}
