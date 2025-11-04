from datetime import datetime
from typing import Literal
import uuid
from pydantic import ConfigDict, Field, computed_field
from sqlalchemy.orm import Mapped, mapped_column

from sqlalchemy import UUID, Enum as SQLAlchemyEnum, ForeignKey, func
from core.constants.model import ModelState, ModelStatus
from core.users.model import UserDTO

from ..base_models import BaseModel, Base


class TaskEntity(Base):
    __tablename__: str = "tasks"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    entity_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True))
    entity: Mapped[str] = mapped_column()

    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(onupdate=func.now(), default=func.now())
    state: Mapped[ModelState | None] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=True
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False), nullable=False
    )


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
        ModelStatus.UNKNOWN,
        ModelStatus.APPROVAL_PENDING,
        ModelStatus.PENDING,
        ModelStatus.REJECTED,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: UserDTO | uuid.UUID = Field()

    model_config = ConfigDict(populate_by_name=True, arbitrary_types_allowed=True)

    @computed_field
    def _entity_name(self) -> str:
        return self.entity
