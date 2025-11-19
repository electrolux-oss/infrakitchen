from datetime import datetime
import uuid

from typing import Any
from pydantic import ConfigDict, Field, computed_field

from core.base_models import BaseModel


class RevisionResponse(BaseModel):
    model: str = Field(...)
    data: dict[str, Any] = Field(...)
    entity_id: str | uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    revision_number: int = Field(default=1)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "revision"


class RevisionCreate(BaseModel):
    model: str = Field(...)
    data: dict[str, Any] = Field(default_factory=dict)
    entity_id: str | uuid.UUID = Field(...)
    revision_number: int = Field(default=1)

    model_config = ConfigDict(from_attributes=True)


class RevisionShort(BaseModel):
    model: str = Field(...)
    entity_id: str | uuid.UUID = Field(...)
    revision_number: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.now)
    name: str | None = Field(default=None)
    description: str | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
