import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import UUID, Boolean, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base

# general settings are a single row, saved under this id
GENERAL_SETTINGS_ID = uuid.UUID(int=2)
INSTANCE_NAME_MAX_LENGTH = 64
BANNER_MESSAGE_MAX_LENGTH = 500
BannerColor = Literal["blue", "green", "orange", "red"]
DEFAULT_BANNER_COLOR: BannerColor = "blue"


class GeneralSettings(Base):
    """Global instance configuration; a single row that is created on the first save."""

    __tablename__: str = "general_settings"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(INSTANCE_NAME_MAX_LENGTH), nullable=False, default="")
    # announcement shown at the top of every page while enabled
    banner_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    banner_message: Mapped[str] = mapped_column(
        String(BANNER_MESSAGE_MAX_LENGTH), nullable=False, default="", server_default=""
    )
    banner_color: Mapped[str] = mapped_column(
        String(16), nullable=False, default=DEFAULT_BANNER_COLOR, server_default=DEFAULT_BANNER_COLOR
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class GeneralSettingsDTO(BaseModel):
    # empty means "not set"
    name: str = Field(default="", max_length=INSTANCE_NAME_MAX_LENGTH)

    banner_enabled: bool = False
    banner_message: str = Field(default="", max_length=BANNER_MESSAGE_MAX_LENGTH)
    banner_color: BannerColor = DEFAULT_BANNER_COLOR

    model_config = ConfigDict(from_attributes=True)

    @field_validator("name", "banner_message")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()

    @property
    def announcement(self) -> str:
        """The banner message users see: empty while the banner is off."""
        return self.banner_message if self.banner_enabled else ""
