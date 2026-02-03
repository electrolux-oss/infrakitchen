from collections.abc import Iterable
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import ValidationRule, ValidationRuleTemplateReference


class ValidationRuleCRUD:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def get_rule_by_id(self, rule_id: UUID) -> ValidationRule | None:
        statement = select(ValidationRule).where(ValidationRule.id == rule_id)
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_rule_by_template_and_name(self, template_id: UUID, variable_name: str) -> ValidationRule | None:
        statement = select(ValidationRule).where(
            ValidationRule.template_id == template_id,
            ValidationRule.variable_name == variable_name,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_rules_by_template(self, template_id: UUID) -> list[ValidationRule]:
        statement = select(ValidationRule).where(ValidationRule.template_id == template_id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_rules_by_template_ids(self, template_ids: Iterable[UUID]) -> list[ValidationRule]:
        template_ids = list(template_ids)
        if not template_ids:
            return []
        statement = select(ValidationRule).where(ValidationRule.template_id.in_(template_ids))
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def create_rule(self, data: dict[str, Any]) -> ValidationRule:
        rule = ValidationRule(**data)
        self.session.add(rule)
        await self.session.flush()
        return rule

    async def update_rule(self, rule: ValidationRule, data: dict[str, Any]) -> ValidationRule:
        for key, value in data.items():
            setattr(rule, key, value)
        await self.session.flush()
        return rule

    async def delete_rule(self, rule: ValidationRule) -> None:
        await self.session.delete(rule)

    async def get_references_by_template(self, template_id: UUID) -> list[ValidationRuleTemplateReference]:
        statement = select(ValidationRuleTemplateReference).where(
            ValidationRuleTemplateReference.template_id == template_id
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_reference_by_template_and_variable(
        self, template_id: UUID, variable_name: str
    ) -> ValidationRuleTemplateReference | None:
        statement = select(ValidationRuleTemplateReference).where(
            ValidationRuleTemplateReference.template_id == template_id,
            ValidationRuleTemplateReference.variable_name == variable_name,
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def create_reference(self, data: dict[str, Any]) -> ValidationRuleTemplateReference:
        reference = ValidationRuleTemplateReference(**data)
        self.session.add(reference)
        await self.session.flush()
        return reference

    async def update_reference(
        self, reference: ValidationRuleTemplateReference, data: dict[str, Any]
    ) -> ValidationRuleTemplateReference:
        for key, value in data.items():
            setattr(reference, key, value)
        await self.session.flush()
        return reference

    async def delete_reference(self, reference: ValidationRuleTemplateReference) -> None:
        await self.session.delete(reference)
