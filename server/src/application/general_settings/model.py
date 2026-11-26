import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field, field_validator
from sqlalchemy import JSON, UUID, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base

# entity id used for audit logs of the general settings
GENERAL_SETTINGS_ID = uuid.UUID(int=2)
INSTANCE_NAME_MAX_LENGTH = 64
BANNER_MESSAGE_MAX_LENGTH = 500
BannerColor = Literal["blue", "green", "orange", "red"]
DEFAULT_BANNER_COLOR: BannerColor = "blue"


class GeneralSettings(Base):
    """Global instance configuration, stored as one name/metadata row per setting."""

    __tablename__: str = "general_settings"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    # "metadata" is reserved by SQLAlchemy as an attribute name; GeneralSettingsDTO defines the known names and types
    setting_metadata: Mapped[Any] = mapped_column("metadata", JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=func.now(), onupdate=func.now()
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)


class BannerSettings(BaseModel):
    enabled: bool = False
    message: str = Field(default="", max_length=BANNER_MESSAGE_MAX_LENGTH)
    color: BannerColor = DEFAULT_BANNER_COLOR

    @field_validator("message")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()


class GeneralSettingsDTO(BaseModel):
    """One field per stored setting (row); nested models are saved as a single JSON value."""

    # empty means "not set"
    name: str = Field(default="", max_length=INSTANCE_NAME_MAX_LENGTH)
    banner: BannerSettings = Field(default_factory=BannerSettings)

    @field_validator("name")
    @classmethod
    def _strip(cls, value: str) -> str:
        return value.strip()

    @property
    def announcement(self) -> str:
        """The banner message users see: empty while the banner is off."""
        return self.banner.message if self.banner.enabled else ""
