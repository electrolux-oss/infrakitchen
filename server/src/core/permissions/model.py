from datetime import datetime
import re
from typing import Literal, override
import uuid

from pydantic import ConfigDict, Field, PrivateAttr, field_validator
from sqlalchemy.orm import Mapped, mapped_column, relationship

from core.users.model import User

from ..base_models import BaseModel, Base
from sqlalchemy import UUID, ForeignKey, Index, func


class Permission(Base):
    __tablename__: str = "casbin_rules"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ptype: Mapped[str] = mapped_column(nullable=False)
    v0: Mapped[str | None] = mapped_column(nullable=True)
    v1: Mapped[str | None] = mapped_column(nullable=True)
    v2: Mapped[str | None] = mapped_column(nullable=True)
    v3: Mapped[str | None] = mapped_column(nullable=True)
    v4: Mapped[str | None] = mapped_column(nullable=True)
    v5: Mapped[str | None] = mapped_column(nullable=True)

    created_at: Mapped[datetime] = mapped_column(default=func.now())
    updated_at: Mapped[datetime] = mapped_column(onupdate=func.now(), default=func.now())
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    creator: Mapped[User] = relationship("User", lazy="joined")
    __table_args__ = (Index("ix_casbin_rules_types", "ptype", "v0", "v1", "v2", "v3", "v4", "v5", unique=True),)

    @override
    def __str__(self):
        arr = [self.ptype]
        for v in (self.v0, self.v1, self.v2, self.v3, self.v4, self.v5):
            if v is None:
                break
            arr.append(v)
        return ", ".join(arr)

    @override
    def __repr__(self):
        return f'<CasbinRule {self.id}: "{self}">'


class PermissionDTO(BaseModel):
    """
    CasbinRule model
    """

    ptype: Literal["p", "g"] = Field(...)
    v0: str | None = Field(default=None)
    v1: str | None = Field(default=None)
    v2: str | None = Field(default=None)
    v3: str | None = Field(default=None)
    v4: str | None = Field(default=None)
    v5: str | None = Field(default=None)
    _users: list[str] = PrivateAttr(default_factory=list)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: uuid.UUID | None = Field(default=None)
    model_config = ConfigDict(
        extra="allow",
    )

    def to_dict(self):
        d = {"ptype": self.ptype}

        for key, value in self.model_dump().items():
            if value is not None and key.startswith("v") and key[1:].isnumeric():
                d[key] = value

        return d

    @override
    def __str__(self):
        return ", ".join(self.to_dict().values())

    @override
    def __repr__(self):
        return f'<PermissionModel :"{str(self)}">'

    @field_validator("v0", "v1", "v2")
    @classmethod
    def validate_field(cls, value: str | None) -> str | None:
        if value is None:
            return None
        pattern = r"[a-z0-9_*:-]+"
        if not re.fullmatch(pattern, value):
            raise ValueError(f"field has to match pattern {pattern}")
        return value
