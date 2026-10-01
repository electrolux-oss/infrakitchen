from datetime import datetime, UTC
from typing import Any
import uuid
from pydantic import BaseModel, ConfigDict, Field

from core.users.schema import UserShort


class AuditLogResponse(BaseModel):
    id: uuid.UUID | None = Field(...)
    model: str = Field(..., title="Model name")
    user_id: uuid.UUID = Field()
    action: str = Field(..., title="Action")
    entity_id: str | uuid.UUID = Field(..., title="Entity ID")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    creator: UserShort | None = Field(default=None)
    revision_number: int | None = Field(default=None)
    metadata: dict[str, Any] | None = Field(default=None, title="Metadata", validation_alias="action_metadata")

    model_config = ConfigDict(from_attributes=True)
