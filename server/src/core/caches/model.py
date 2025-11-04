from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base

from sqlalchemy import UUID, DateTime, LargeBinary, func


class Cache(Base):
    __tablename__: str = "caches"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    module: Mapped[str] = mapped_column(index=True)
    key: Mapped[str] = mapped_column(index=True)
    value: Mapped[bytes] = mapped_column(LargeBinary)
    expire_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())


class CacheDTO(BaseModel):
    id: uuid.UUID = Field(...)
    module: str = Field(..., title="Module name")
    key: str = Field(..., title="Cache key")
    value: bytes = Field(..., title="Cache value")
    expire_at: datetime = Field(default_factory=datetime.now)
    model_config = ConfigDict(from_attributes=True)
