from datetime import datetime
import logging
from typing import Literal
import uuid

from pydantic import ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column

from ..base_models import BaseModel, Base

from sqlalchemy import JSON, UUID, DateTime, func


logger = logging.getLogger(__name__)


class Worker(Base):
    __tablename__: str = "workers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column()
    host: Mapped[str] = mapped_column()
    host_metadata: Mapped[dict[str, str]] = mapped_column(JSON, default={})
    status: Mapped[str] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), onupdate=func.now(), default=func.now())


class WorkerDTO(BaseModel):
    id: uuid.UUID | None = Field(default=None)
    name: str = Field(..., title="Worker name")
    host: str = Field(..., title="Worker host")
    host_metadata: dict[str, str] = Field(default={}, title="Worker metadata")
    status: Literal["free", "busy"] = Field(default="free", title="Worker status")
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    model_config = ConfigDict(from_attributes=True)
