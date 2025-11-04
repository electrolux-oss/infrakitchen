from datetime import datetime
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, DateTime, ForeignKey, JSON, Index, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.integrations.model import Integration, IntegrationDTO
from application.workspaces.schema import WorkspaceMeta
from core.base_models import Base

from core.constants.model import ModelStatus
from core.users.model import User, UserDTO


class Workspace(Base):
    __tablename__: str = "workspaces"

    name: Mapped[str] = mapped_column()
    workspace_provider: Mapped[str] = mapped_column()
    integration_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("integrations.id"))
    integration: Mapped[Integration] = relationship("Integration", lazy="joined")
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.DONE,
    )

    description: Mapped[str] = mapped_column(default="")
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    creator: Mapped[User] = relationship("User", lazy="joined")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (Index("ix_name_integration_id", "name", "integration_id", unique=True),)


class WorkspaceDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: UserDTO | uuid.UUID = Field()

    status: Literal[
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
    ] = Field(default=ModelStatus.DONE)

    name: str = Field(...)
    description: str = Field(default="")
    workspace_provider: Literal["github", "bitbucket", "azure_devops"] = Field(..., frozen=True)
    integration: IntegrationDTO = Field(...)

    configuration: WorkspaceMeta = Field(...)

    integration_id: uuid.UUID | str = Field(..., frozen=True)

    model_config = ConfigDict(from_attributes=True)
