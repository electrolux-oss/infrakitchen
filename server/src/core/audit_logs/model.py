from datetime import datetime
import uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.users.model import User
from ..base_models import Base
from sqlalchemy import UUID, ForeignKey, DateTime, func


class AuditLog(Base):
    __tablename__: str = "audit_logs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    model: Mapped[str] = mapped_column()
    user_id: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    action: Mapped[str] = mapped_column()
    entity_id: Mapped[uuid.UUID] = mapped_column()
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=False), default=func.now())
    creator: Mapped[User] = relationship("User", lazy="joined")
