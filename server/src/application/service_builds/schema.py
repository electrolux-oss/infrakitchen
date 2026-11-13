from datetime import datetime
import re
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from application.integrations.schema import IntegrationShort
from core.constants.model import ModelStatus
from core.users.schema import UserShort


class ServiceBuildResponse(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    commit_sha: str
    registry_integration_id: uuid.UUID | None = Field(default=None)
    registry_integration: IntegrationShort | None = Field(default=None)
    image_repository: str
    tag: str
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


IMAGE_TAG_RE = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}$")


def validate_image_tag(tag: str) -> str:
    tag = tag.strip()
    if not IMAGE_TAG_RE.match(tag):
        raise ValueError(
            "Tag must be letters, digits, '_', '.' and '-', not starting with '.' or '-', at most 128 characters"
        )
    return tag
