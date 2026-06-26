import uuid
from collections import defaultdict

import strawberry
from sqlalchemy import select
from strawberry.types import Info

from application.validation_rules.model import ValidationRule, ValidationRuleTemplateReference
from graphql_api.helpers import IsAuthenticated, check_api_permission
from graphql_api.modules.validation_rule.types import ValidationRulesByVariableType, ValidationRuleType


@strawberry.type
class ValidationRuleQuery:
    @strawberry.field(permission_classes=[IsAuthenticated])
    async def predefined_validation_rules(self, info: Info) -> list[ValidationRuleType]:
        await check_api_permission(info, "validation_rule", ["read"])
        session = info.context["session"]
        stmt = select(ValidationRule).where(ValidationRule.description.isnot(None))
        result = await session.execute(stmt)
        return result.scalars().all()

    @strawberry.field(permission_classes=[IsAuthenticated])
    async def validation_rules_by_template(
        self,
        info: Info,
        template_id: uuid.UUID,
        variable_name: str | None = None,
    ) -> list[ValidationRulesByVariableType]:
        await check_api_permission(info, "validation_rule", ["read"])
        session = info.context["session"]
        stmt = select(ValidationRuleTemplateReference).where(ValidationRuleTemplateReference.template_id == template_id)
        if variable_name:
            stmt = stmt.where(ValidationRuleTemplateReference.variable_name == variable_name)

        result = await session.execute(stmt)
        references = result.scalars().all()

        grouped: dict[str, list[ValidationRule]] = defaultdict(list)
        for ref in references:
            if ref.validation_rule is not None:
                grouped[ref.variable_name].append(ref.validation_rule)

        return [
            ValidationRulesByVariableType(
                variable_name=var_name,
                rules=rules,
            )
            for var_name, rules in sorted(grouped.items())
        ]
