import uuid
from datetime import datetime
from typing import Any

from pydantic import Field, ConfigDict

from core.base_models import BaseModel


class ResourceTempStateCreate(BaseModel):
    resource_id: str | uuid.UUID = Field(...)
    value: dict[str, str] = Field(...)

    model_config = ConfigDict(from_attributes=True)


class ResourceTempStateUpdate(BaseModel):
    value: dict[str, str] = Field(...)
    creator_id: str | uuid.UUID = Field(...)

    model_config = ConfigDict(from_attributes=True)


class ResourceTempStateResponse(BaseModel):
    id: uuid.UUID | None = Field(default=None)
    resource_id: str | uuid.UUID = Field(...)
    value: dict[str, Any] = Field(...)

    created_by: str | uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now, frozen=True)

    model_config = ConfigDict(from_attributes=True)
