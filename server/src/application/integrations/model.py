from datetime import datetime
from typing import Annotated, Any, Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import UUID, DateTime, Enum as SQLAlchemyEnum, ForeignKey, func


from core.base_models import BaseRevision

from sqlalchemy import Index, JSON

from core.users.model import User, UserDTO

from core.constants.model import ModelStatus
from .schema import (
    AzureReposSshIntegrationConfig,
    integration_provider_type,
    AWSIntegrationConfig,
    GCPIntegrationConfig,
    AzureRMIntegrationConfig,
    AzureReposIntegrationConfig,
    MongoDBAtlasIntegrationConfig,
    GithubIntegrationConfig,
    GithubSshIntegrationConfig,
    BitbucketIntegrationConfig,
    BitbucketSshIntegrationConfig,
    DatadogIntegrationConfig,
)


class Integration(BaseRevision):
    __tablename__: str = "integrations"

    name: Mapped[str] = mapped_column()
    description: Mapped[str] = mapped_column()
    integration_type: Mapped[str] = mapped_column()
    integration_provider: Mapped[str] = mapped_column()
    configuration: Mapped[dict[str, Any]] = mapped_column(JSON)
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

    __table_args__ = (
        Index(
            "ix_name_integration_type_integration_provider",
            "name",
            "integration_type",
            "integration_provider",
            unique=True,
        ),
    )


class IntegrationDTO(BaseModel):
    id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    status: Literal[
        ModelStatus.ENABLED,
        ModelStatus.DISABLED,
    ] = Field(default=ModelStatus.ENABLED)

    revision_number: int = Field(default=1)
    created_by: UserDTO | uuid.UUID = Field()

    name: str = Field(
        ...,
    )
    description: str = Field(default="")
    integration_type: Literal["cloud", "git"] = Field(..., frozen=True)
    integration_provider: integration_provider_type = Field(..., frozen=True)
    labels: list[str] = Field(default_factory=list)
    configuration: Annotated[
        AWSIntegrationConfig
        | GCPIntegrationConfig
        | AzureRMIntegrationConfig
        | AzureReposIntegrationConfig
        | AzureReposSshIntegrationConfig
        | MongoDBAtlasIntegrationConfig
        | GithubIntegrationConfig
        | GithubSshIntegrationConfig
        | BitbucketIntegrationConfig
        | BitbucketSshIntegrationConfig
        | DatadogIntegrationConfig,
        Field(discriminator="integration_provider"),
    ] = Field(...)
    model_config = ConfigDict(from_attributes=True)
