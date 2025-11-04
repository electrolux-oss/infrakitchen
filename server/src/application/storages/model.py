from datetime import datetime
from typing import Annotated, Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.integrations.model import Integration, IntegrationDTO
from application.storages.schema import AWSStorageConfig, GCPStorageConfig, AzureRMStorageConfig, storage_providers
from core.base_models import BaseEntity

from core.constants.model import ModelState, ModelStatus
from core.users.model import User, UserDTO


class Storage(BaseEntity):
    __tablename__: str = "storages"

    name: Mapped[str] = mapped_column()
    storage_type: Mapped[str] = mapped_column()
    storage_provider: Mapped[str] = mapped_column()
    integration_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("integrations.id"))
    integration: Mapped[Integration] = relationship("Integration", lazy="joined")
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    description: Mapped[str] = mapped_column(default="")
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    creator: Mapped[User] = relationship("User", lazy="joined")

    state: Mapped[ModelState] = mapped_column(
        SQLAlchemyEnum(ModelState, name="model_state", native_enum=False), nullable=False, default=ModelState.PROVISION
    )
    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.READY,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class StorageDTO(BaseModel):
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
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.READY,
        ModelStatus.QUEUED,
    ] = Field(default=ModelStatus.READY)

    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(...)
    description: str = Field(default="")
    storage_type: Literal["tofu"] = Field(..., frozen=True)
    storage_provider: storage_providers = Field(..., frozen=True)
    integration_id: uuid.UUID | str = Field(..., frozen=True)
    integration: IntegrationDTO = Field(frozen=True)
    configuration: Annotated[
        AWSStorageConfig | GCPStorageConfig | AzureRMStorageConfig, Field(discriminator="storage_provider")
    ] = Field(...)

    model_config = ConfigDict(from_attributes=True)
