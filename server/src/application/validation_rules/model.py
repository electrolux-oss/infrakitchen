from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum as SQLAlchemyEnum, JSON, UniqueConstraint, Index, func
from sqlalchemy.orm import Mapped, mapped_column

from core.base_models import Base
from .types import ValidationRuleDataType


class ValidationRule(Base):
    __tablename__: str = "validation_rules"

    entity_name: Mapped[str] = mapped_column(nullable=False)
    field_path: Mapped[str] = mapped_column(nullable=False)
    data_type: Mapped[ValidationRuleDataType] = mapped_column(
        SQLAlchemyEnum(ValidationRuleDataType, name="validation_rule_data_type", native_enum=False), nullable=False
    )
    regex: Mapped[str | None] = mapped_column(nullable=True)
    no_whitespace: Mapped[bool] = mapped_column(default=False)
    max_length: Mapped[int | None] = mapped_column(nullable=True)
    min_value: Mapped[float | None] = mapped_column(nullable=True)
    max_value: Mapped[float | None] = mapped_column(nullable=True)
    rule_metadata: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), onupdate=func.now(), default=func.now())

    __table_args__ = (
        Index("ix_validation_rules_entity", "entity_name"),
        UniqueConstraint("entity_name", "field_path", name="uq_validation_rules_entity_field"),
    )
