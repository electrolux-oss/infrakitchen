from datetime import datetime
import uuid

from sqlalchemy import UUID, DateTime, ForeignKey, Index, func
from sqlalchemy import Enum as SQLAlchemyEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from application.integrations.model import Integration
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
    registry_integration_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("integrations.id", name="fk_service_build_registry_integration_id", ondelete="SET NULL"),
        nullable=True,
    )
    registry_integration: Mapped[Integration | None] = relationship("Integration", lazy="joined")
    image_repository: Mapped[str] = mapped_column()
    tag: Mapped[str] = mapped_column()
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
