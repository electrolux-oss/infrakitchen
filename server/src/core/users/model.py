from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, EmailStr, Field

from core.users.schema import UserShort

from ..models.encrypted_secret import EncryptedSecretStr

from ..base_models import Base
from sqlalchemy import UUID, Column, ForeignKey, Index, DateTime, Table, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

user_account_associations = Table(
    "user_accounts_associations",
    Base.metadata,
    Column("primary_user_id", ForeignKey("users.id"), primary_key=True),
    Column("secondary_user_id", ForeignKey("users.id"), primary_key=True),
    UniqueConstraint("secondary_user_id", name="uq_secondary_user_id"),
)


class User(Base):
    __tablename__: str = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str | None] = mapped_column()
    identifier: Mapped[str] = mapped_column()
    password: Mapped[str | None] = mapped_column()
    first_name: Mapped[str | None] = mapped_column()
    last_name: Mapped[str | None] = mapped_column()
    display_name: Mapped[str | None] = mapped_column()
    provider: Mapped[str] = mapped_column()
    deactivated: Mapped[bool] = mapped_column(default=False)
    description: Mapped[str] = mapped_column(default="")
    is_primary: Mapped[bool] = mapped_column(default=False, nullable=True)
    secondary_accounts: Mapped[list["User"]] = relationship(
        "User",
        secondary=user_account_associations,
        primaryjoin=id == user_account_associations.c.primary_user_id,
        secondaryjoin=id == user_account_associations.c.secondary_user_id,
        back_populates="primary_account",
    )

    primary_account: Mapped[list["User"]] = relationship(
        "User",
        secondary=user_account_associations,
        primaryjoin=id == user_account_associations.c.secondary_user_id,
        secondaryjoin=id == user_account_associations.c.primary_user_id,
        back_populates="secondary_accounts",
    )

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    __table_args__ = (Index("ix_identifier_provider", "identifier", "provider", unique=True),)


class UserDTO(BaseModel):
    id: uuid.UUID = Field()
    email: EmailStr | None = Field(default=None, title="Email")
    identifier: str = Field(..., title="Identifier", frozen=True)
    password: EncryptedSecretStr | None = Field(default=None, title="Password")
    first_name: str | None = Field(default=None, title="First name")
    last_name: str | None = Field(default=None, title="Last name")
    display_name: str | None = Field(default=None, title="Display name")
    provider: str = Field(..., title="Provider", frozen=True)
    deactivated: bool = Field(default=False, title="Deactivated")
    description: str | None = Field(default="", title="Description")
    is_primary: bool | None = Field(default=False, title="Is primary user")
    secondary_accounts: list[UserShort] = Field(default_factory=list, title="Secondary accounts")
    primary_account: list[UserShort] = Field(default_factory=list, title="Primary account for secondary users")
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)
