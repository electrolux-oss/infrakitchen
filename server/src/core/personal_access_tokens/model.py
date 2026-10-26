from datetime import UTC, datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import JSON, UUID, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.base_models import Base
from core.models.encrypted_secret import EncryptedSecretStr
from core.users.model import User


class PersonalAccessToken(Base):
    __tablename__: str = "personal_access_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    user: Mapped[User] = relationship("User", lazy="joined")
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    token_hash: Mapped[str] = mapped_column(nullable=False)
    token_prefix: Mapped[str] = mapped_column(String(32), nullable=False)
    # NULL = full permissions of the owning user (developer token).
    # Non-NULL = granted scope list, e.g. ["read:resource", "write:resource"];
    # the token is treated as an agent token and enforcement clamps access to
    # these scopes (must be a subset of the owner's own permissions).
    scopes: Mapped[list[str] | None] = mapped_column(JSON, default=None, nullable=True)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    __table_args__ = (
        Index("ix_personal_access_tokens_user_id", "user_id"),
        Index("ix_personal_access_tokens_token_prefix", "token_prefix"),
    )


class PersonalAccessTokenDTO(BaseModel):
    id: uuid.UUID = Field(...)
    user_id: uuid.UUID = Field(...)
    name: str = Field(...)
    token_hash: EncryptedSecretStr = Field(...)
    token_prefix: str = Field(...)
    scopes: list[str] | None = Field(default=None)
    expires_at: datetime | None = Field(default=None)
    last_used_at: datetime | None = Field(default=None)
    revoked_at: datetime | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)

    model_config = ConfigDict(from_attributes=True)
