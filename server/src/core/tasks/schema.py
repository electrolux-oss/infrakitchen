from datetime import datetime
from typing import Literal
import uuid
from pydantic import BaseModel, ConfigDict, Field, computed_field

from core.constants.model import ModelState, ModelStatus
from core.users.model import UserDTO


class TaskEntityResponse(BaseModel):
    id: uuid.UUID = Field(...)
    entity_id: str | uuid.UUID = Field(...)
    entity: str = Field(...)
    state: (
        Literal[
            ModelState.PROVISIONED,
            ModelState.PROVISION,
            ModelState.DESTROY,
            ModelState.DESTROYED,
        ]
        | None
    ) = Field(default=None)
    status: Literal[
        ModelStatus.QUEUED,
        ModelStatus.IN_PROGRESS,
        ModelStatus.DONE,
        ModelStatus.ERROR,
        ModelStatus.UNKNOWN,
        ModelStatus.APPROVAL_PENDING,
        ModelStatus.PENDING,
        ModelStatus.REJECTED,
        ModelStatus.READY,
    ] = Field(default=ModelStatus.QUEUED)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: UserDTO | uuid.UUID = Field()

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return self.entity
