import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, JSON, Index, func, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base


class ResourceTempState(Base):
    __tablename__: str = "resources_temp_state"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    resource_id: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=False)

    value: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(onupdate=func.now(), default=func.now())
    __table_args__ = (Index("ix_resources_temp_state_resource_id", "resource_id", unique=True),)


class ResourceTempStateDTO(BaseModel):
    id: uuid.UUID = Field()
    resource_id: str | uuid.UUID = Field(...)
    value: dict[str, Any] = Field(...)

    created_by: str | uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)
