from datetime import datetime
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from core.constants.model import ModelStatus
from core.users.schema import UserShort


class ServiceBuildResponse(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    commit_sha: str
    version: str | None = Field(default=None)
    image: str | None = Field(default=None)
    image_digest: str | None = Field(default=None)
    status: ModelStatus
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
    created_at: datetime
    creator: UserShort | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "service_build"
