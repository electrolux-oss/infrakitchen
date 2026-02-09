from datetime import datetime
from typing import Literal
import uuid

from pydantic import BaseModel, ConfigDict, Field, computed_field

from core.users.schema import UserShort


class BatchOperationCreate(BaseModel):
    name: str = Field(...)
    description: str = Field(default="")
    entity_type: Literal["resource", "executor"] = Field(default="resource")
    entity_ids: list[uuid.UUID] = Field(...)

    model_config = ConfigDict(from_attributes=True)


class BatchOperationResponse(BaseModel):
    id: uuid.UUID = Field(...)
    name: str = Field(...)
    description: str = Field(default="")

    entity_type: Literal["resource", "executor"] = Field(default="resource")
    entity_ids: list[uuid.UUID] = Field(default_factory=list)

    creator: UserShort = Field()
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)

    @computed_field
    def _entity_name(self) -> str:
        return "batch_operation"


class BatchOperationResponseWithErrors(BatchOperationResponse):
    error_entity_ids: dict[uuid.UUID, str] = Field(default_factory=dict)
    model_config = ConfigDict(from_attributes=True)
