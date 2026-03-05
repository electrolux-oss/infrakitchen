from datetime import datetime
from typing import Any
import uuid

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import UUID, Column, DateTime, ForeignKey, JSON, Table, func, Integer, String, Text

from core.base_models import Base, BaseRevision
from core.constants.model import ModelStatus
from core.users.model import User

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from application.templates.model import Template


blueprint_templates = Table(
    "blueprint_templates",
    Base.metadata,
    Column("blueprint_id", ForeignKey("blueprints.id", ondelete="CASCADE"), primary_key=True),
    Column("template_id", ForeignKey("templates.id", ondelete="CASCADE"), primary_key=True),
    Column("position", Integer, nullable=False, default=0),
)


class Blueprint(BaseRevision):
    """
    A blueprint combines multiple templates and defines how the outputs of one
    template feed into the inputs of another when the blueprint is executed.
    """

    __tablename__: str = "blueprints"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Ordered list of templates that make up this blueprint
    templates: Mapped[list["Template"]] = relationship(
        "Template",
        secondary=blueprint_templates,
        lazy="selectin",
        order_by=blueprint_templates.c.position,
    )

    # Wiring config: maps template outputs → template inputs
    # Structure:
    # [
    #   {
    #     "source_template_id": "<uuid>",
    #     "source_output": "vpc_id",
    #     "target_template_id": "<uuid>",
    #     "target_variable": "vpc_id"
    #   },
    #   ...
    # ]
    wiring: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    # Default variable overrides per template
    # Structure: { "<template_id>": { "var_name": "value", ... }, ... }
    default_variables: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    # General configuration (integration defaults, workspace, etc.)
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    labels: Mapped[list[str]] = mapped_column(JSON, default=list)

    creator: Mapped[User] = relationship("User", lazy="joined")
    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    status: Mapped[str] = mapped_column(
        nullable=False,
        default=ModelStatus.ENABLED,
    )

    revision_number: Mapped[int] = mapped_column(default=1)
