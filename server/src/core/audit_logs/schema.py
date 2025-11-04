from datetime import datetime
import uuid
from pydantic import BaseModel, ConfigDict, Field

from core.users.schema import UserShort


class AuditLogResponse(BaseModel):
    id: uuid.UUID | None = Field(...)
    model: str = Field(..., title="Model name")
    user_id: uuid.UUID = Field()
    action: str = Field(..., title="Action")
    entity_id: str | uuid.UUID = Field(..., title="Entity ID")
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    creator: UserShort | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
