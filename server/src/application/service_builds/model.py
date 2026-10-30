from datetime import datetime
import uuid

from sqlalchemy import UUID, DateTime, ForeignKey, Index, func
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base
from core.constants.model import ModelStatus
from core.users.model import User


class ServiceBuild(Base):
    __tablename__: str = "service_builds"

    service_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("services.id", name="fk_service_build_service_id", ondelete="CASCADE"),
    )
    commit_sha: Mapped[str] = mapped_column()
    version: Mapped[str | None] = mapped_column(nullable=True)
    image: Mapped[str | None] = mapped_column(nullable=True)
    image_digest: Mapped[str | None] = mapped_column(nullable=True)

    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.QUEUED,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    creator: Mapped[User] = relationship("User", lazy="joined")

    __table_args__ = (
        Index("ix_service_build_service_id_created_at", "service_id", "created_at"),
        Index("ix_service_build_service_id_commit_sha", "service_id", "commit_sha"),
    )
