from datetime import datetime, UTC
import uuid

from pydantic import ConfigDict, Field

from ..base_models import BaseModel


class LogResponse(BaseModel):
    entity_id: str | uuid.UUID = Field(...)
    entity: str = Field(...)
    revision: int = Field(default=1)
    audit_log_id: str | uuid.UUID | None = Field(default=None)
    level: str = Field(default="info")
    data: str = Field(...)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    execution_start: int = Field(default=1)
    expire_at: datetime | None = Field(default=None)
    trace_id: str | uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
