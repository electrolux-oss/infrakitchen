from datetime import UTC, datetime
from typing import Literal
import uuid

from pydantic import ConfigDict, Field, computed_field
from sqlalchemy import UUID, DateTime, Enum as SQLAlchemyEnum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base, BaseModel
from core.constants.model import ModelActions, ModelState, ModelStatus
from core.users.model import User, UserDTO


class TaskEntity(Base):
    __tablename__: str = "tasks"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    entity: Mapped[str] = mapped_column()
    action: Mapped[ModelActions | None] = mapped_column(
        SQLAlchemyEnum(ModelActions, name="model_actions", native_enum=False), nullable=True
    )
    run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error: Mapped[str | None] = mapped_column(nullable=True)

    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(onupdate=func.now(), default=func.now())
    state: Mapped[ModelState | None] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=True
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False), nullable=False
    )
    creator: Mapped[User] = relationship("User", lazy="joined")


class TaskEntityModel(BaseModel):
    entity_id: str | uuid.UUID = Field(...)
    entity: str = Field(...)
    state: (
        Literal[
            ModelState.PROVISIONED,
            ModelState.PROVISION,
            ModelState.DESTROY,
            ModelState.DESTROYED,
        ]
        | None
    ) = Field(default=None)
    status: Literal[
        ModelStatus.QUEUED,
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.CANCELLED,
        ModelStatus.UNKNOWN,
        ModelStatus.APPROVAL_PENDING,
        ModelStatus.PENDING,
        ModelStatus.REJECTED,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)
    action: ModelActions | None = Field(default=None)
    run_at: datetime | None = Field(default=None)
    error: str | None = Field(default=None)

    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    created_by: UserDTO | uuid.UUID = Field()

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    @computed_field
    def _entity_name(self) -> str:
        return self.entity
