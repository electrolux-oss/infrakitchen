from datetime import datetime
from decimal import Decimal
from enum import StrEnum
import uuid

from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import (
    UUID,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
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


class ValidationRuleTargetType(StrEnum):
    STRING = "string"
    NUMBER = "number"


class ValidationRule(Base):
    __tablename__: str = "validation_rules"

    target_type: Mapped[ValidationRuleTargetType] = mapped_column(
        SQLAlchemyEnum(ValidationRuleTargetType, name="validation_rule_target_type", native_enum=False),
        nullable=False,
    )
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    min_value: Mapped[Decimal | None] = mapped_column(Numeric(precision=20, scale=5), nullable=True)
    max_value: Mapped[Decimal | None] = mapped_column(Numeric(precision=20, scale=5), nullable=True)
    regex_pattern: Mapped[str | None] = mapped_column(Text, nullable=True)
    max_length: Mapped[int | None] = mapped_column(Integer, nullable=True)

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
        Index(
            "ix_validation_rules_signature",
            "target_type",
            "description",
            "min_value",
            "max_value",
            "regex_pattern",
            "max_length",
        ),
    )


class ValidationRuleTemplateReference(Base):
    __tablename__: str = "validation_rule_template_references"

    template_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("templates.id", ondelete="CASCADE"), nullable=False
    )
    template: Mapped[Template] = relationship("Template", foreign_keys=[template_id], lazy="joined")
    variable_name: Mapped[str] = mapped_column(String, nullable=False)
    validation_rule_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("validation_rules.id", ondelete="CASCADE"), nullable=False
    )
    validation_rule: Mapped[ValidationRule] = relationship(
        "ValidationRule",
        foreign_keys=[validation_rule_id],
        lazy="joined",
    )

    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    creator: Mapped[User | None] = relationship("User", foreign_keys=[created_by], lazy="joined")

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (
        Index(
            "ix_validation_rule_template_reference_var",
            "template_id",
            "variable_name",
            "validation_rule_id",
            unique=True,
        ),
    )


class ValidationRuleDTO(BaseModel):
    id: uuid.UUID = Field(...)

    target_type: ValidationRuleTargetType = Field(...)
    description: str | None = Field(default=None)
    min_value: Decimal | None = Field(default=None)
    max_value: Decimal | None = Field(default=None)
    regex_pattern: str | None = Field(default=None)
    max_length: int | None = Field(default=None)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)


class ValidationRuleTemplateReferenceDTO(BaseModel):
    id: uuid.UUID = Field(...)

    template_id: uuid.UUID = Field(...)
    variable_name: str = Field(...)
    validation_rule_id: uuid.UUID = Field(...)

    created_at: datetime = Field(default_factory=datetime.now, frozen=True)
    updated_at: datetime = Field(default_factory=datetime.now)
    created_by: uuid.UUID | None = Field(default=None)

    model_config = ConfigDict(from_attributes=True)
