import uuid
from datetime import datetime

import strawberry
from strawberry_sqlalchemy_mapper import StrawberrySQLAlchemyMapper

from application.validation_rules.model import ValidationRule


validation_rule_mapper = StrawberrySQLAlchemyMapper()


@validation_rule_mapper.type(ValidationRule)
class ValidationRuleType:
    __exclude__ = ["created_by", "creator"]

    id: uuid.UUID = strawberry.UNSET  # type: ignore[assignment]


validation_rule_mapper.finalize()


@strawberry.type
class ValidationRulesByVariableType:
    variable_name: str
    rules: list[ValidationRuleType]


@strawberry.type
class ValidationRuleTemplateReferenceType:
    id: uuid.UUID
    template_id: uuid.UUID
    variable_name: str
    validation_rule_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
