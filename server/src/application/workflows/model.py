from datetime import datetime
from typing import Any
import uuid

from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import UUID, DateTime, ForeignKey, JSON, func, Integer, Text

from core.base_models import Base
from core.constants.model import ModelStatus
from core.users.model import User


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
    integration_ids: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)
    secret_ids: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)
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

    template_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    resource_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    source_code_version_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    parent_resource_ids: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)
    integration_ids: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)
    secret_ids: Mapped[list[uuid.UUID]] = mapped_column(JSON, default=list)
    storage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    position: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(default=ModelStatus.PENDING)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Resolved variables after wiring substitution
    resolved_variables: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
