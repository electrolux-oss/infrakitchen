from datetime import datetime, UTC
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.integrations.model import Integration, IntegrationDTO
from application.types import CodeLanguageType, GitProviderType
from core.base_models import Base, BaseRevision
from sqlalchemy import UUID, DateTime, ForeignKey, Index, JSON, Text, func
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
    default_branch: Mapped[str | None] = mapped_column(nullable=True)
    git_tag_shas: Mapped[dict[str, str] | None] = mapped_column(JSON(none_as_null=True), nullable=True, default=None)
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


class SourceCodeCommit(Base):
    __tablename__: str = "source_code_commits"

    source_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("source_codes.id", name="fk_source_code_commit_source_code_id", ondelete="CASCADE"),
    )
    branch: Mapped[str] = mapped_column()
    sha: Mapped[str] = mapped_column()
    # Lower is newer; new commits go below the stored ones, so it can be negative.
    position: Mapped[int] = mapped_column()
    message: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column(Text, default="")
    author_name: Mapped[str] = mapped_column()
    author_email: Mapped[str] = mapped_column()
    authored_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        Index("ix_source_code_commit_source_code_id_branch_sha", "source_code_id", "branch", "sha", unique=True),
        Index("ix_source_code_commit_source_code_id_branch_position", "source_code_id", "branch", "position"),
    )


class RefFolders(BaseModel):
    ref: str
    folders: list[str]


class SourceCodeDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
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
    source_code_provider: GitProviderType = Field(..., frozen=True)
    source_code_language: CodeLanguageType = Field(..., frozen=True)
    integration_id: uuid.UUID | str | None = Field(default=None, frozen=True)
    integration: IntegrationDTO | None = Field(default=None)
    git_tags: list[str] = Field(default_factory=list)
    git_tag_messages: dict[str, str] | None = Field(default_factory=dict)
    git_branches: list[str] = Field(default_factory=list)
    git_branch_messages: dict[str, str] | None = Field(default_factory=dict)
    git_folders_map: list[RefFolders] = Field(default_factory=list)
    default_branch: str | None = Field(default=None)
    git_tag_shas: dict[str, str] | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
