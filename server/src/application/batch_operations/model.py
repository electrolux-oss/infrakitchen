from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base
from core.users.model import User, UserDTO

from sqlalchemy import UUID, DateTime, ForeignKey, JSON, func


class BatchOperation(Base):
    __tablename__: str = "batch_operations"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column(default="")

    entity_type: Mapped[str] = mapped_column(default="resource")
    entity_ids: Mapped[list[Any]] = mapped_column(JSON, default=list)

    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    creator: Mapped[User] = relationship("User", lazy="joined")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())


class BatchOperationDTO(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    description: str = Field(default="")

    entity_ids: list[uuid.UUID] = Field(default_factory=list)
    entity_type: str = Field(default="resource")

    created_by: UserDTO | uuid.UUID = Field()

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    model_config = ConfigDict(from_attributes=True)
