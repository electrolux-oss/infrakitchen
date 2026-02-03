from datetime import datetime
from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict, Field

from .model import ValidationRuleTargetType


class ValidationRuleBase(BaseModel):
    target_type: ValidationRuleTargetType = Field(...)
    min_value: Decimal | None = Field(default=None)
    max_value: Decimal | None = Field(default=None)
    regex_pattern: str | None = Field(default=None)


class ValidationRuleCreate(ValidationRuleBase):
    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)


class ValidationRuleUpdate(ValidationRuleBase):
    id: uuid.UUID | None = Field(default=None)
    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)


class ValidationRuleResponse(ValidationRuleBase):
    id: uuid.UUID = Field(...)
    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    inherited_from_template_id: uuid.UUID | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)


class ValidationRuleReferenceCreate(BaseModel):
    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    reference_template_id: uuid.UUID | None = Field(default=None)


class ValidationRuleReferenceResponse(BaseModel):
    id: uuid.UUID = Field(...)
    template_id: uuid.UUID = Field(...)
    reference_template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)

    model_config = ConfigDict(from_attributes=True)
