import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import JSON, UUID, BigInteger, DateTime, ForeignKey, Identity, Index, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base

# Postgres NOTIFY channel used to wake up idle workers when new tasks are enqueued
TASK_QUEUE_CHANNEL = "ik_task_queue"


class TaskQueueKind(StrEnum):
    ENTITY_TASK = "entity_task"
    SCHEDULER_JOB = "scheduler_job"


class TaskQueueStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    DONE = "done"
    FAILED = "failed"
    CANCELLED = "cancelled"


FINISHED_STATUSES = (TaskQueueStatus.DONE, TaskQueueStatus.FAILED, TaskQueueStatus.CANCELLED)


class TaskQueueItem(Base):
    """A unit of work waiting for, or being processed by, a worker.

    Workers pull items with ``SELECT ... FOR UPDATE SKIP LOCKED`` and hold them
    with a lease (``locked_until``) that is extended by heartbeats. An expired
    lease means the worker died and the item is reaped by another worker.
    """

    __tablename__: str = "task_queue"
    __table_args__: tuple[Any, ...] = (
        Index(
            "ix_task_queue_queued",
            "priority",
            "available_at",
            "seq",
            postgresql_where=text("status = 'queued'"),
        ),
        # At most one running task per entity
        Index(
            "uq_task_queue_running_entity",
            "entity",
            "entity_id",
            unique=True,
            postgresql_where=text("status = 'running'"),
        ),
        Index("ix_task_queue_status_locked_until", "status", "locked_until"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Insertion order; tasks enqueued in one transaction share created_at, so this keeps them FIFO
    seq: Mapped[int] = mapped_column(BigInteger, Identity(), nullable=False)
    kind: Mapped[str] = mapped_column(String(32), default=TaskQueueKind.ENTITY_TASK)
    entity: Mapped[str] = mapped_column()
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    action: Mapped[str | None] = mapped_column(nullable=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    status: Mapped[str] = mapped_column(String(16), default=TaskQueueStatus.QUEUED)
    priority: Mapped[int] = mapped_column(default=0)
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    attempts: Mapped[int] = mapped_column(default=0)
    retries: Mapped[int] = mapped_column(default=0)
    max_retries: Mapped[int] = mapped_column(default=3)

    worker_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("workers.id", ondelete="SET NULL"), nullable=True
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(nullable=True)

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class TaskQueueItemDTO(BaseModel):
    id: uuid.UUID
    kind: TaskQueueKind = Field(default=TaskQueueKind.ENTITY_TASK)
    entity: str
    entity_id: uuid.UUID | None = Field(default=None)
    action: str | None = Field(default=None)
    payload: dict[str, Any] = Field(default_factory=dict)
    status: TaskQueueStatus = Field(default=TaskQueueStatus.QUEUED)
    priority: int = Field(default=0)
    available_at: datetime | None = Field(default=None)
    attempts: int = Field(default=0)
    retries: int = Field(default=0)
    max_retries: int = Field(default=3)
    worker_id: uuid.UUID | None = Field(default=None)
    locked_until: datetime | None = Field(default=None)
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
    error: str | None = Field(default=None)
    created_by: uuid.UUID | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(from_attributes=True)


@dataclass(frozen=True)
class SupersededTask:
    """A queued task cancelled because a newer request for the same entity arrived."""

    id: uuid.UUID
    action: str | None
    created_by: uuid.UUID | None
    entity: str
    entity_id: uuid.UUID
    replaced_by_action: str | None
    replaced_by_user: uuid.UUID | None


class WaitingReason(StrEnum):
    ENTITY_BUSY = "entity_busy"  # another task for the same entity is running
    RETRY_DELAY = "retry_delay"  # re-queued after a not-ready error, waiting for its delay
    CANCEL_WINDOW = "cancel_window"  # just requested; held back briefly so the user can cancel it
    NO_WORKERS = "no_workers"  # no worker has sent a heartbeat recently
    WORKERS_BUSY = "workers_busy"  # workers are online but all busy
    PENDING_PICKUP = "pending_pickup"  # a worker is free and will claim it shortly


class QueuedTaskInfo(BaseModel):
    """A queued or running task as shown on its entity's page."""

    id: uuid.UUID
    entity: str
    action: str | None = None
    status: TaskQueueStatus
    created_at: datetime
    available_at: datetime | None = None
    started_at: datetime | None = None
    retries: int = 0
    max_retries: int = 3
    position: int | None = Field(default=None, title="1-based position among all queued tasks")
    worker_host: str | None = None
    creator_id: uuid.UUID | None = None
    creator_name: str | None = None
    waiting_reason: WaitingReason | None = None


class EntityQueueStatus(BaseModel):
    tasks: list[QueuedTaskInfo] = Field(default_factory=list)
    workers_free: int = 0
    workers_online: int = 0


class TaskQueueStats(BaseModel):
    queued: int = Field(default=0, title="Tasks ready to be claimed")
    delayed: int = Field(default=0, title="Queued tasks waiting for their retry delay")
    running: int = Field(default=0, title="Tasks currently leased by a worker")
    oldest_queued_seconds: float = Field(default=0.0, title="Age of the oldest claimable task")
    workers_free: int = Field(default=0)
    workers_busy: int = Field(default=0)
    workers_offline: int = Field(default=0)
