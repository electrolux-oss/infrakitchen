from datetime import datetime
from decimal import Decimal
import uuid

from pydantic import BaseModel, ConfigDict, Field

from .model import ValidationRuleTargetType


class ValidationRuleBase(BaseModel):
    """
    Base model for validation rules, containing common fields for both creation and response models.
    """

    id: uuid.UUID | None = Field(default=None)
    target_type: ValidationRuleTargetType = Field(...)
    description: str | None = Field(default=None)
    min_value: Decimal | None = Field(default=None)
    max_value: Decimal | None = Field(default=None)
    regex_pattern: str | None = Field(default=None)
    max_length: int | None = Field(default=None)


class ValidationRuleResponse(ValidationRuleBase):
    """
    Response model for validation rules, including fields that are returned when fetching validation rules.
    """

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class ValidationRulesByVariableResponse(BaseModel):
    """Validation rules grouped by variable name."""

    variable_name: str = Field(...)
    rules: list[ValidationRuleResponse] = Field(default_factory=list)


class ValidationRuleTemplateReferenceCreate(BaseModel):
    """
    Request model for creating a new validation rule template reference.
    """

    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    rule: ValidationRuleBase = Field(...)


class ValidationRuleTemplateReference(BaseModel):
    """
    Container for a single validation rule template reference record.
    """

    id: uuid.UUID = Field(...)

    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    validation_rule_id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now, frozen=True)
    created_by: uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class ValidationRuleTemplateReferenceReplace(BaseModel):
    """Request payload for replacing validation rules assigned to a variable."""

    rules: list[ValidationRuleBase] = Field(default_factory=list)
