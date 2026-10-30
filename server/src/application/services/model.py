from datetime import datetime, UTC
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship

from application.projects.model import Project
from application.resources.model import Resource
from application.source_codes.model import SourceCode
from core.base_models import Base, BaseRevision
from sqlalchemy import UUID, Column, DateTime, ForeignKey, Index, JSON, Table, func

from core.users.model import User, UserDTO


service_owners = Table(
    "service_owners",
    Base.metadata,
    Column("service_id", ForeignKey("services.id"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)


class Service(BaseRevision):
    __tablename__: str = "services"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(index=True)
    description: Mapped[str | None] = mapped_column()
    version: Mapped[str | None] = mapped_column(nullable=True)

    project_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("projects.id", name="fk_service_project_id"),
        nullable=False,
    )
    project: Mapped["Project"] = relationship("Project", lazy="joined")

    source_code_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_codes.id", name="fk_service_source_code_id"),
        nullable=True,
    )
    source_code: Mapped["SourceCode | None"] = relationship("SourceCode", lazy="joined")

    image_resource_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("resources.id", name="fk_service_image_resource_id", ondelete="SET NULL"),
        nullable=True,
    )
    image_resource: Mapped["Resource | None"] = relationship("Resource", lazy="joined")
    dockerfile_path: Mapped[str] = mapped_column(default="Dockerfile", server_default="Dockerfile")
    build_context: Mapped[str] = mapped_column(default=".", server_default=".")

    labels: Mapped[list[str]] = mapped_column(JSON, default=list)

    creator: Mapped[User] = relationship("User", lazy="joined")
    owners: Mapped[list[User]] = relationship(secondary=service_owners, lazy="selectin")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    revision_number: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Names are unique per project rather than globally, so two projects can each own an "api" service.
    __table_args__ = (Index("ix_service_project_id_name", "project_id", "name", unique=True),)


class ServiceDTO(BaseModel):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(...)
    description: str = Field(default="")
    version: str | None = Field(default=None)
    project_id: uuid.UUID = Field(...)
    source_code_id: uuid.UUID | None = Field(default=None)
    image_resource_id: uuid.UUID | None = Field(default=None)
    dockerfile_path: str = Field(default="Dockerfile")
    build_context: str = Field(default=".")
    owners: list[UserDTO] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
