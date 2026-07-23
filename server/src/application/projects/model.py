from datetime import datetime, UTC
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship

from application.common.schema import DependencyConfig, DependencyTag
from application.projects.schema import ProjectConfig
from application.workspaces.model import Workspace
from core.base_models import Base, BaseRevision
from sqlalchemy import UUID, Column, DateTime, ForeignKey, JSON, Table, func
from sqlalchemy import Enum as SQLAlchemyEnum

from core.constants.model import ModelStatus
from core.users.model import User, UserDTO


project_owners = Table(
    "project_owners",
    Base.metadata,
    Column("project_id", ForeignKey("projects.id"), primary_key=True),
    Column("user_id", ForeignKey("users.id"), primary_key=True),
)


class Project(BaseRevision):
    __tablename__: str = "projects"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(unique=True, index=True)
    description: Mapped[str | None] = mapped_column()

    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", name="fk_project_workspace_id"),
        nullable=True,
    )
    workspace: Mapped["Workspace"] = relationship("Workspace", lazy="joined")

    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    dependency_tags: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    dependency_config: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)

    creator: Mapped[User] = relationship("User", lazy="joined")
    owners: Mapped[list[User]] = relationship(secondary=project_owners, lazy="selectin")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.ENABLED,
    )

    revision_number: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class ProjectDTO(BaseModel):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(...)
    description: str = Field(default="")
    workspace_id: uuid.UUID | None = Field(default=None)
    configuration: ProjectConfig = Field(default_factory=ProjectConfig)
    owners: list[UserDTO] = Field(default_factory=list)
    dependency_tags: list[DependencyTag] = Field(default_factory=list)
    dependency_config: list[DependencyConfig] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
