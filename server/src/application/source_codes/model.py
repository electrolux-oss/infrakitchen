from datetime import datetime
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.integrations.model import Integration, IntegrationDTO
from core.base_models import BaseRevision
from sqlalchemy import UUID, DateTime, ForeignKey, JSON, func
from core.constants.model import ModelStatus
from core.users.model import User, UserDTO


class SourceCode(BaseRevision):
    __tablename__ = "source_codes"

    description: Mapped[str | None] = mapped_column(default="")
    source_code_url: Mapped[str] = mapped_column(unique=True, nullable=False, index=True)
    source_code_provider: Mapped[str] = mapped_column()
    source_code_language: Mapped[str] = mapped_column()
    integration_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("integrations.id"), nullable=True)
    integration: Mapped[Integration] = relationship("Integration", lazy="joined")
    git_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    git_tag_messages: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=True)
    git_branches: Mapped[list[str]] = mapped_column(JSON, default=list)
    git_branch_messages: Mapped[dict[str, str]] = mapped_column(JSON, default=dict, nullable=True)
    git_folders_map: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    creator: Mapped[User] = relationship("User", lazy="joined")

    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.READY,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class RefFolders(BaseModel):
    ref: str
    folders: list[str]


class SourceCodeDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.READY,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.READY)

    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    description: str = Field(default="")
    source_code_url: str = Field(
        ...,
        frozen=True,
    )
    source_code_provider: Literal["github", "gitlab", "bitbucket", "azure_devops"] = Field(..., frozen=True)
    source_code_language: Literal["opentofu"] = Field(..., frozen=True)
    integration_id: uuid.UUID | str | None = Field(default=None, frozen=True)
    integration: IntegrationDTO | None = Field(default=None)
    git_tags: list[str] = Field(default_factory=list)
    git_tag_messages: dict[str, str] | None = Field(default_factory=dict)
    git_branches: list[str] = Field(default_factory=list)
    git_branch_messages: dict[str, str] | None = Field(default_factory=dict)
    git_folders_map: list[RefFolders] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)
