from datetime import datetime
from typing import Annotated, Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, DateTime, ForeignKey, JSON, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.integrations.model import Integration, IntegrationDTO
from application.secrets.schema import (
    AWSSecretConfig,
    CustomSecretConfig,
    GCPSecretConfig,
    secret_providers,
)
from core.base_models import BaseEntity

from core.constants.model import ModelStatus
from core.users.model import User, UserDTO


class Secret(BaseEntity):
    __tablename__: str = "secrets"

    name: Mapped[str] = mapped_column()
    secret_type: Mapped[str] = mapped_column()
    secret_provider: Mapped[str] = mapped_column()
    integration_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("integrations.id"))
    integration: Mapped[Integration | None] = relationship("Integration", lazy="joined")
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    description: Mapped[str] = mapped_column(default="")
    labels: Mapped[list[str]] = mapped_column(JSON, default=list)
    creator: Mapped[User] = relationship("User", lazy="joined")

    status: Mapped[ModelStatus] = mapped_column(
        SQLAlchemyEnum(ModelStatus, name="model_status", native_enum=False),
        nullable=False,
        default=ModelStatus.ENABLED,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class SecretDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(...)
    description: str = Field(default="")
    secret_type: Literal["tofu"] = Field(..., frozen=True)
    secret_provider: secret_providers = Field(..., frozen=True)
    integration_id: uuid.UUID | str | None = Field(default=None, frozen=True)
    integration: IntegrationDTO | None = Field(default=None, frozen=True)
    configuration: Annotated[
        AWSSecretConfig | GCPSecretConfig | CustomSecretConfig,
        Field(discriminator="secret_provider"),
    ] = Field(...)

    model_config = ConfigDict(from_attributes=True)
