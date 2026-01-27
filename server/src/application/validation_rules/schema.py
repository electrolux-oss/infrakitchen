from datetime import datetime
from typing import Any
import uuid

from pydantic import BaseModel, ConfigDict, Field

from .types import ValidationRuleDataType


class ValidationRuleBase(BaseModel):
    entity_name: str = Field(...)
    field_path: str = Field(...)
    data_type: ValidationRuleDataType = Field(...)
    regex: str | None = Field(default=None)
    no_whitespace: bool = Field(default=False)
    max_length: int | None = Field(default=None)
    min_value: float | None = Field(default=None)
    max_value: float | None = Field(default=None)
    rule_metadata: dict[str, Any] = Field(default_factory=dict)


class ValidationRuleResponse(ValidationRuleBase):
    id: uuid.UUID = Field(...)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)
