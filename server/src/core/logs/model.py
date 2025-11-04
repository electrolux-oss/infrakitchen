from datetime import datetime
import uuid

from pydantic import ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column

from ..base_models import Base, BaseModel

from sqlalchemy import UUID, DateTime, Index, func


class Log(Base):
    __tablename__: str = "logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    entity: Mapped[str] = mapped_column()
    revision: Mapped[int] = mapped_column(default=1)
    level: Mapped[str] = mapped_column(default="info")
    data: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    execution_start: Mapped[int] = mapped_column(default=1)
    expire_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    trace_id: Mapped[str | None] = mapped_column(default=None)
    __table_args__ = (
        Index("ix_trace_id", "trace_id"),
        Index("ix_execution_start", "execution_start"),
        Index("ix_created_at", "created_at", postgresql_using="btree"),
        Index("ix_expire_at", "expire_at", postgresql_using="btree"),
        Index("ix_entity_id", "entity_id"),
    )


class LogDTO(BaseModel):
    entity_id: str | uuid.UUID = Field(...)
    entity: str = Field(...)
    revision: int = Field(default=1)
    level: str = Field(default="info")
    data: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.now)
    execution_start: int = Field(default=1)
    expire_at: datetime | None = Field(default=None)
    trace_id: str | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
