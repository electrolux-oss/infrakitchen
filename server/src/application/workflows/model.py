from datetime import datetime
from typing import TYPE_CHECKING, Any
import uuid

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import UUID, Column, DateTime, ForeignKey, JSON, Table, func, Integer, Text

from application.integrations.model import Integration
from application.secrets.model import Secret
from application.templates.model import Template
from core.base_models import Base
from core.constants.model import ModelStatus
from core.users.model import User

if TYPE_CHECKING:
    from application.resources.model import Resource

workflow_integrations = Table(
    "workflow_integrations",
    Base.metadata,
    Column("workflow_id", ForeignKey("workflows.id", ondelete="CASCADE"), primary_key=True),
    Column("integration_id", ForeignKey("integrations.id", ondelete="CASCADE"), primary_key=True),
)

workflow_secrets = Table(
    "workflow_secrets",
    Base.metadata,
    Column("workflow_id", ForeignKey("workflows.id", ondelete="CASCADE"), primary_key=True),
    Column("secret_id", ForeignKey("secrets.id", ondelete="CASCADE"), primary_key=True),
)

workflow_step_integrations = Table(
    "workflow_step_integrations",
    Base.metadata,
    Column("workflow_step_id", ForeignKey("workflow_steps.id", ondelete="CASCADE"), primary_key=True),
    Column("integration_id", ForeignKey("integrations.id", ondelete="CASCADE"), primary_key=True),
)

workflow_step_secrets = Table(
    "workflow_step_secrets",
    Base.metadata,
    Column("workflow_step_id", ForeignKey("workflow_steps.id", ondelete="CASCADE"), primary_key=True),
    Column("secret_id", ForeignKey("secrets.id", ondelete="CASCADE"), primary_key=True),
)


class Workflow(Base):
    __tablename__: str = "workflows"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    blueprint_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    # Snapshot of wiring at execution time (immutable after creation)
    wiring_snapshot: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)

    # Variable overrides provided at execution time
    variable_overrides: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    parent_overrides: Mapped[dict[str, list[uuid.UUID]]] = mapped_column(JSON, default=dict)
    source_code_version_overrides: Mapped[dict[str, uuid.UUID]] = mapped_column(JSON, default=dict)
    integration_ids: Mapped[list[Integration]] = relationship(secondary=workflow_integrations)
    secret_ids: Mapped[list[Secret]] = relationship(secondary=workflow_secrets)
    storage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    status: Mapped[str] = mapped_column(default=ModelStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    creator: Mapped[User] = relationship("User", lazy="joined")

    steps: Mapped[list["WorkflowStep"]] = relationship(
        "WorkflowStep",
        back_populates="workflow",
        lazy="selectin",
        order_by="WorkflowStep.position",
    )

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())


class WorkflowStep(Base):
    __tablename__: str = "workflow_steps"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"))
    workflow: Mapped[Workflow] = relationship("Workflow", back_populates="steps")

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("templates.id"))
    template: Mapped[Template] = relationship("Template", lazy="joined")
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("resources.id"), nullable=True)
    resource: Mapped["Resource | None"] = relationship("Resource", lazy="joined")
    source_code_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    parent_resource_ids: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)
    integration_ids: Mapped[list[Integration]] = relationship(secondary=workflow_step_integrations)
    secret_ids: Mapped[list[Secret]] = relationship(secondary=workflow_step_secrets)
    storage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    position: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(default=ModelStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Resolved variables after wiring substitution
    resolved_variables: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
