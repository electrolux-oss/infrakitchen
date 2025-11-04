from datetime import datetime
from typing import Annotated, Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column

from core.users.model import UserDTO
from ..base_models import Base
from .schema import (
    BackstageProviderConfig,
    GithubProviderConfig,
    GuestProviderConfig,
    IKServiceAccountProviderConfig,
    MicrosoftProviderConfig,
)

from sqlalchemy import JSON, UUID, DateTime, ForeignKey, func


class AuthProvider(Base):
    __tablename__: str = "auth_providers"

    name: Mapped[str] = mapped_column(unique=True, index=True)
    description: Mapped[str] = mapped_column(default="")
    enabled: Mapped[bool] = mapped_column(default=True)
    auth_provider: Mapped[str] = mapped_column(unique=True, index=True)
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON, default={})
    filter_by_domain: Mapped[list[str]] = mapped_column(JSON, default=[])

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[str | uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))


class AuthProviderDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    enabled: bool = Field(default=True)
    auth_provider: Literal["microsoft", "guest", "github", "backstage", "ik_service_account"] = Field(..., frozen=True)
    configuration: Annotated[
        MicrosoftProviderConfig
        | GithubProviderConfig
        | BackstageProviderConfig
        | GuestProviderConfig
        | IKServiceAccountProviderConfig,
        Field(discriminator="auth_provider"),
    ] = Field(...)
    model_config = ConfigDict(from_attributes=True)
    filter_by_domain: list[str] = Field(default=[])
