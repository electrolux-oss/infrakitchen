from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base, BaseRevision
from sqlalchemy import UUID, Column, DateTime, ForeignKey, JSON, Table, func
from sqlalchemy import Enum as SQLAlchemyEnum

from core.constants.model import ModelStatus
from core.users.model import User, UserDTO


template_links = Table(
    "template_links",
    Base.metadata,
    Column("parent_id", ForeignKey("templates.id"), primary_key=True),
    Column("child_id", ForeignKey("templates.id"), primary_key=True),
)


class Template(BaseRevision):
    __tablename__: str = "templates"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(unique=True, index=True)
    description: Mapped[str | None] = mapped_column()
    template: Mapped[str] = mapped_column(unique=True, index=True)
    # Self-referential many-to-many relationship
    children: Mapped[list["Template"]] = relationship(
        "Template",
        secondary=template_links,
        primaryjoin=id == template_links.c.parent_id,
        secondaryjoin=id == template_links.c.child_id,
        back_populates="parents",
        lazy="selectin",
    )
    parents: Mapped[list["Template"]] = relationship(
        "Template",
        secondary=template_links,
        primaryjoin=id == template_links.c.child_id,
        secondaryjoin=id == template_links.c.parent_id,
        back_populates="children",
        lazy="selectin",
    )
    cloud_resource_types: Mapped[list[str]] = mapped_column(JSON, default=list)
    abstract: Mapped[bool] = mapped_column(default=False)

    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    creator: Mapped[User] = relationship("User", lazy="joined")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.ENABLED,
    )

    revision_number: Mapped[int] = mapped_column(default=1)
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class TemplateDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    abstract: bool = Field(default=False)
    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    template: str = Field(
        ...,
        frozen=True,
    )
    parents: list[uuid.UUID] = Field(
        default_factory=list,
    )
    children: list[uuid.UUID] = Field(
        default_factory=list,
    )
    cloud_resource_types: list[str] = Field(default_factory=list)
    labels: list[str] = Field(default_factory=list)
    model_config = ConfigDict(from_attributes=True)
