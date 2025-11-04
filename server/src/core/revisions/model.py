from datetime import datetime
import uuid

from sqlalchemy.orm import Mapped, mapped_column
from ..base_models import Base


from typing import Any


from sqlalchemy import UUID, DateTime, JSON, func


class Revision(Base):
    __tablename__: str = "revisions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model: Mapped[str] = mapped_column()
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default={})
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now(), onupdate=func.now())
    revision_number: Mapped[int] = mapped_column()
