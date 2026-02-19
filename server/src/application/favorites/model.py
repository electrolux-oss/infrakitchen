import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import UUID, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from core.base_models import Base


class FavoriteBase(DeclarativeBase):
    metadata = Base.metadata


class Favorite(FavoriteBase):
    __tablename__: str = "favorites"

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), primary_key=True)
    component_type: Mapped[str] = mapped_column(String, primary_key=True)
    component_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())

    __table_args__ = (Index("ix_favorites_user_id", "user_id"),)


class FavoriteCreate(BaseModel):
    component_type: str = Field(...)
    component_id: uuid.UUID = Field(...)


class FavoriteDTO(BaseModel):
    user_id: uuid.UUID = Field(...)
    component_type: str = Field(...)
    component_id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)

    model_config = ConfigDict(from_attributes=True)
