from datetime import datetime
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from core.constants.model import ModelStatus
from core.users.schema import UserShort


class ServiceBuildImageResponse(BaseModel):
    registry_integration_id: uuid.UUID
    registry_name: str
    registry_provider: str
    image_repository: str
    image: str | None = Field(default=None)


class ServiceBuildResponse(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    commit_sha: str
    images: list[ServiceBuildImageResponse] = Field(default_factory=list)
    tag: str
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


IMAGE_TAG_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")


def validate_image_tag(tag: str) -> str:
    tag = tag.strip()
    if not IMAGE_TAG_RE.match(tag):
        raise ValueError(
            "Tag must be letters, digits, '_', '.' and '-', not starting with '.' or '-', at most 128 characters"
        )
    return tag
