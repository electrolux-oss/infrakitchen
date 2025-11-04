import uuid
from datetime import datetime

from pydantic import BaseModel, model_validator
from pydantic import ConfigDict, Field
from sqlalchemy import UUID, Boolean, ForeignKey, String, func, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base


class FeatureFlag(Base):
    __tablename__ = "feature_flags"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    config_name: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, onupdate=func.now(), default=func.now(), nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class FeatureFlagDTO(BaseModel):
    name: str = Field(default="")
    config_name: str = Field(default="")
    enabled: bool | None = Field(default=None)
    updated_by: uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def set_config_name(self):
        if not self.config_name and self.name:
            self.config_name = self.name.lower().replace(" ", "_")
        return self

    def __eq__(self, other):
        if not isinstance(other, FeatureFlagDTO):
            return NotImplemented
        return self.name == other.name and self.enabled == other.enabled

    def __hash__(self):
        return hash((self.name, self.enabled))
