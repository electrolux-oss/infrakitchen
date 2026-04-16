from datetime import datetime, UTC
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field


class WorkerResponse(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(..., title="Worker name")
    host: str = Field(..., title="Worker host")
    host_metadata: dict[str, str] = Field(default={}, title="Worker metadata")
    status: Literal["free", "busy"] = Field(default="free", title="Worker status")
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC), frozen=True)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "worker"
