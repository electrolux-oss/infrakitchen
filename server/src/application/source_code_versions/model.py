from datetime import datetime
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum, Index

from sqlalchemy import UUID, DateTime, ForeignKey, func
from application.templates.model import Template
from application.source_code_versions.schema import OutputVariableModel, VariableConfigModel, VariableModel
from application.source_codes.model import SourceCode, SourceCodeDTO
from sqlalchemy import JSON
from core.base_models import Base, BaseRevision
from core.constants.model import ModelStatus
from core.users.model import User, UserDTO


class SourceCodeVersion(BaseRevision):
    __tablename__: str = "source_code_versions"

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("templates.id", ondelete="CASCADE"))
    template: Mapped[Template] = relationship("Template", lazy="joined")
    source_code_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_codes.id", ondelete="CASCADE")
    )
    source_code: Mapped[SourceCode] = relationship("SourceCode", lazy="joined")
    source_code_version: Mapped[str | None] = mapped_column()
    source_code_branch: Mapped[str | None] = mapped_column()
    source_code_folder: Mapped[str] = mapped_column(default="")
    variables: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    outputs: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(default="")
    variable_configs: Mapped[list["SourceConfig"]] = relationship(
        "SourceConfig",
        # lazy="joined",
    )
    output_configs: Mapped[list["SourceOutputConfig"]] = relationship(
        "SourceOutputConfig",
        # lazy="joined",
    )

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

    __table_args__ = (
        Index(
            "ix_source_code_version_branch_unique",
            "source_code_id",
            "source_code_version",
            "source_code_folder",
            unique=True,
        ),
        Index(
            "ix_source_code_version_version_unique",
            "source_code_id",
            "source_code_branch",
            "source_code_folder",
            unique=True,
        ),
    )


class SourceConfig(Base):
    __tablename__: str = "source_codes_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    source_code_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_code_versions.id", ondelete="CASCADE")
    )

    index: Mapped[int] = mapped_column()
    required: Mapped[bool] = mapped_column(default=False)
    default: Mapped[Any] = mapped_column(JSON, nullable=True)
    frozen: Mapped[bool] = mapped_column(default=False)
    unique: Mapped[bool] = mapped_column(default=False)
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column()
    type: Mapped[str] = mapped_column()
    options: Mapped[list[str]] = mapped_column(JSON, default=list)
    reference_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("source_codes_output_configs.id", ondelete="CASCADE"), nullable=True
    )
    reference: Mapped["SourceOutputConfig"] = relationship("SourceOutputConfig", lazy="joined")


class SourceOutputConfig(Base):
    __tablename__: str = "source_codes_output_configs"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    source_code_version_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_code_versions.id", ondelete="CASCADE")
    )

    index: Mapped[int] = mapped_column()
    name: Mapped[str] = mapped_column(nullable=False)
    description: Mapped[str] = mapped_column()


class SourceCodeVersionDTO(BaseModel):
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

    template_id: uuid.UUID = Field(..., frozen=True)
    source_code_id: uuid.UUID = Field(..., frozen=True)
    source_code: SourceCodeDTO | None = Field(default=None, frozen=True)
    source_code_version: str | None = Field(default=None, frozen=True)
    source_code_branch: str | None = Field(default=None, frozen=True)
    source_code_folder: str = Field(default="", frozen=True)
    variables_config: list[VariableConfigModel] = Field(default_factory=list)
    variables: list[VariableModel] = Field(default_factory=list)
    outputs: list[OutputVariableModel] = Field(default_factory=list)
    description: str = Field(default="")
    labels: list[str] = Field(default_factory=list)

    model_config = ConfigDict(from_attributes=True)


class SourceConfigDTO:
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    index: int = Field(default=0)
    source_code_version_id: uuid.UUID = Field(...)
    required: bool = Field(default=False)
    default: Any | None = Field(default=None)
    frozen: bool = Field(default=False)
    unique: bool = Field(default=False)
    name: str = Field(...)
    description: str = Field(...)
    type: str = Field(...)
    options: list[str] = Field(default_factory=list)
    reference_id: list["SourceConfigDTO"] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)


class SourceOutputConfigDTO:
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    index: int = Field(default=0)
    source_code_version_id: uuid.UUID = Field(...)
    name: str = Field(...)
    description: str = Field(...)
    model_config = ConfigDict(from_attributes=True)
