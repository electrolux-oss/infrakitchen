from datetime import datetime
from typing import Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.templates.model import Template, TemplateDTO
from application.integrations.model import Integration, IntegrationDTO
from application.source_code_versions.model import SourceCodeVersion, SourceCodeVersionDTO
from application.workspaces.model import Workspace
from core.base_models import Base, BaseEntity
from core.constants.model import ModelState, ModelStatus
from core.users.model import User, UserDTO
from ..storages.model import Storage, StorageDTO
from .schema import Outputs, Variables, DependencyTag, DependencyConfig, ResourceShort

from sqlalchemy import UUID, ForeignKey, Table
from sqlalchemy import Column, Index, JSON


resource_links = Table(
    "resource_links",
    Base.metadata,
    Column("parent_id", ForeignKey("resources.id"), primary_key=True),
    Column("child_id", ForeignKey("resources.id"), primary_key=True),
)

resource_integrations = Table(
    "resource_integrations",
    Base.metadata,
    Column("resource_id", ForeignKey("resources.id", ondelete="CASCADE"), primary_key=True),
    Column("integration_id", ForeignKey("integrations.id", ondelete="CASCADE"), primary_key=True),
)


class Resource(BaseEntity):
    __tablename__: str = "resources"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column(default="")

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("templates.id"))
    template: Mapped[Template] = relationship("Template", lazy="joined")

    source_code_version_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("source_code_versions.id"), nullable=True
    )
    source_code_version: Mapped[SourceCodeVersion | None] = relationship("SourceCodeVersion", lazy="joined")
    integration_ids: Mapped[list[Integration]] = relationship(secondary=resource_integrations)
    storage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("storages.id"), nullable=True)
    storage: Mapped[Storage] = relationship("Storage", lazy="joined")
    storage_path: Mapped[str | None] = mapped_column(nullable=True)
    variables: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    outputs: Mapped[list[Any]] = mapped_column(JSON, default=list)
    dependency_tags: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    dependency_config: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    parents: Mapped[list["Resource"]] = relationship(
        "Resource",
        secondary=resource_links,
        primaryjoin=id == resource_links.c.parent_id,
        secondaryjoin=id == resource_links.c.child_id,
        back_populates="children",
    )
    children: Mapped[list["Resource"]] = relationship(
        "Resource",
        secondary=resource_links,
        primaryjoin=id == resource_links.c.child_id,
        secondaryjoin=id == resource_links.c.parent_id,
        back_populates="parents",
    )
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    abstract: Mapped[bool] = mapped_column(default=False)
    creator: Mapped[User] = relationship("User", lazy="joined")
    workspace_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("workspaces.id", name="fk_resource_workspace_id"),
        nullable=True,
    )
    workspace: Mapped[Workspace | None] = relationship("Workspace", lazy="joined")
    state: Mapped[ModelState] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=False, default=ModelState.PROVISION
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.QUEUED,
    )

    __table_args__ = (
        Index("ix_template_id_scv_id_name", "template_id", "source_code_version_id", "name", unique=True),
        Index("ix_resource_name_template_id", "name", "template_id", unique=True),
    )


class ResourceDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    state: Literal[
        ModelState.PROVISIONED,
        ModelState.PROVISION,
        ModelState.DESTROY,
        ModelState.DESTROYED,
    ] = Field(default=ModelState.PROVISION)
    status: Literal[
        ModelStatus.QUEUED,
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.UNKNOWN,
        ModelStatus.APPROVAL_PENDING,
        ModelStatus.PENDING,
        ModelStatus.REJECTED,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)

    abstract: bool = Field(default=False)
    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(
        ...,
        frozen=True,
    )
    description: str = Field(default="")
    template_id: uuid.UUID | TemplateDTO = Field(..., frozen=True)

    source_code_version_id: uuid.UUID | SourceCodeVersionDTO | None = Field(
        default=None,
    )
    source_code_version: SourceCodeVersionDTO | None = Field(default=None)

    integration_ids: list[uuid.UUID | IntegrationDTO] = Field(
        default=[],
    )

    storage_id: uuid.UUID | StorageDTO | None = Field(
        default=None,
    )
    storage_path: str | None = Field(
        default=None,
    )
    variables: list[Variables] = Field(default=[])
    outputs: list[Outputs] = Field(default=[])
    dependency_tags: list[DependencyTag] = Field(default_factory=list)
    dependency_config: list[DependencyConfig] = Field(default_factory=list)
    parents: list[uuid.UUID | ResourceShort] = Field(
        default_factory=list,
    )
    children: list[uuid.UUID | ResourceShort] = Field(
        default_factory=list,
    )
    labels: list[str] = Field(default_factory=list)
    workspace_id: uuid.UUID | None = Field(
        default=None,
    )
    model_config = ConfigDict(from_attributes=True)
