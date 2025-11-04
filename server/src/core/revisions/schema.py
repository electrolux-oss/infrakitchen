from datetime import datetime
import uuid

from typing import Any
from pydantic import BaseModel, ConfigDict, Field, computed_field


class RevisionResponse(BaseModel):
    id: uuid.UUID = Field(...)
    model: str = Field(..., title="Model name")
    data: dict[str, Any] = Field(..., title="Data")
    entity_id: str | uuid.UUID = Field(..., title="Entity ID")
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    revision_number: int = Field(default=1)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "revision"


class RevisionShort(BaseModel):
    id: uuid.UUID = Field(...)
    model: str = Field(..., title="Model name")
    entity_id: str | uuid.UUID = Field(..., title="Entity ID")
    revision_number: int = Field(default=1)
    created_at: datetime = Field(default_factory=datetime.now)
    name: str | None = Field(default=None, title="Optional name for the revision")
    description: str | None = Field(default=None, title="Optional description for the revision")

    model_config = ConfigDict(from_attributes=True)
