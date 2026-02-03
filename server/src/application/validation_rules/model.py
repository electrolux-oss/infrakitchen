from datetime import datetime
from decimal import Decimal
from enum import Enum
from typing import Self
import uuid

from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import (
    UUID,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import Enum as SQLAlchemyEnum

from application.templates.model import Template
from core.base_models import Base
from core.users.model import User


class ValidationRuleTargetType(str, Enum):
    STRING = "string"
    NUMBER = "number"


class ValidationRule(Base):
    __tablename__: str = "validation_rules"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    template: Mapped[Template] = relationship("Template", foreign_keys=[template_id], lazy="joined")

    variable_name: Mapped[str] = mapped_column(String, nullable=False)
    target_type: Mapped[ValidationRuleTargetType] = mapped_column(
        SQLAlchemyEnum(ValidationRuleTargetType, name="validation_rule_target_type", native_enum=False),
        nullable=False,
    )
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(precision=20, scale=5), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(precision=20, scale=5), nullable=True)
    regex_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    creator: Mapped[User | None] = relationship("User", foreign_keys=[created_by], lazy="joined")

    __table_args__ = (
        CheckConstraint(
            "(min_value IS NULL) OR (max_value IS NULL) OR (min_value <= max_value)",
            name="ck_validation_rules_min_le_max",
        ),
        Index("ix_validation_rules_template_variable", "template_id", "variable_name", unique=True),
    )


class ValidationRuleTemplateReference(Base):
    __tablename__: str = "validation_rule_template_references"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    template: Mapped[Template] = relationship("Template", foreign_keys=[template_id], lazy="joined")

    reference_template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    reference_template: Mapped[Template] = relationship(
        "Template", foreign_keys=[reference_template_id], lazy="joined", overlaps="template"
    )

    variable_name: Mapped[str] = mapped_column(String, nullable=False)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (
        CheckConstraint("template_id <> reference_template_id", name="ck_validation_ref_template_not_self"),
        Index("ix_validation_rule_template_reference_var", "template_id", "variable_name", unique=True),
    )


class ValidationRuleDTO(BaseModel):
    id: uuid.UUID = Field(...)
    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    target_type: ValidationRuleTargetType = Field(...)
    min_value: Decimal | None = Field(default=None)
    max_value: Decimal | None = Field(default=None)
    regex_pattern: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class ValidationRuleTemplateReferenceDTO(BaseModel):
    id: uuid.UUID = Field(...)
    template_id: uuid.UUID = Field(...)
    reference_template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="after")
    def validate_templates(self) -> Self:
        if self.template_id == self.reference_template_id:
            raise ValueError("template_id and reference_template_id cannot be the same")
        return self
