from typing import Any
from uuid import UUID

from application.templates.model import Template
from core.users.model import User
from core.utils.model_tools import is_valid_uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .model import ValidationRule, ValidationRuleTemplateReference


class ValidationRuleCRUD:
    def __init__(self, session: AsyncSession):
        self.session: AsyncSession = session

    async def get_rule_by_id(self, rule_id: str | UUID) -> ValidationRule | None:
        if not is_valid_uuid(rule_id):
            raise ValueError(f"Invalid UUID: {rule_id}")

        statement = (
            select(ValidationRule).where(ValidationRule.id == rule_id).join(User, ValidationRule.created_by == User.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_all_rules(self) -> list[ValidationRule]:
        statement = select(ValidationRule).join(User, ValidationRule.created_by == User.id)
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_rule_by_attributes(
        self,
        *,
        target_type,
        description,
        min_value,
        max_value,
        regex_pattern,
        max_length,
    ) -> ValidationRule | None:
        statement = select(ValidationRule).where(ValidationRule.target_type == target_type)

        def _match(field, value):
            nonlocal statement
            if value is None:
                statement = statement.where(field.is_(None))
            else:
                statement = statement.where(field == value)

        _match(ValidationRule.description, description)
        _match(ValidationRule.min_value, min_value)
        _match(ValidationRule.max_value, max_value)
        _match(ValidationRule.regex_pattern, regex_pattern)
        _match(ValidationRule.max_length, max_length)

        result = await self.session.execute(statement.limit(1))
        return result.scalar_one_or_none()

    async def get_rules_by_template(self, template_id: str | UUID) -> list[ValidationRule]:
        if not is_valid_uuid(template_id):
            raise ValueError(f"Invalid UUID: {template_id}")

        statement = (
            select(ValidationRule)
            .join(
                ValidationRuleTemplateReference,
                ValidationRuleTemplateReference.validation_rule_id == ValidationRule.id,
            )
            .where(ValidationRuleTemplateReference.template_id == template_id)
            .distinct()
        )
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

    async def get_reference_by_id(self, rule_id: str | UUID) -> ValidationRuleTemplateReference | None:
        if not is_valid_uuid(rule_id):
            raise ValueError(f"Invalid UUID: {rule_id}")

        statement = (
            select(ValidationRuleTemplateReference)
            .where(ValidationRuleTemplateReference.id == rule_id)
            .join(ValidationRule, ValidationRuleTemplateReference.validation_rule_id == ValidationRule.id)
            .join(User, ValidationRuleTemplateReference.created_by == User.id)
            .join(Template, ValidationRuleTemplateReference.template_id == Template.id)
        )
        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_references_by_template(self, template_id: str | UUID) -> list[ValidationRuleTemplateReference]:
        statement = select(ValidationRuleTemplateReference).where(
            ValidationRuleTemplateReference.template_id == template_id
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_references_by_template_and_variable(
        self, template_id: str | UUID, variable_name: str
    ) -> list[ValidationRuleTemplateReference]:
        statement = select(ValidationRuleTemplateReference).where(
            ValidationRuleTemplateReference.template_id == template_id,
            ValidationRuleTemplateReference.variable_name == variable_name,
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def get_rules_by_template_and_variable(
        self, template_id: str | UUID, variable_name: str
    ) -> list[ValidationRule]:
        statement = (
            select(ValidationRule)
            .join(
                ValidationRuleTemplateReference,
                ValidationRuleTemplateReference.validation_rule_id == ValidationRule.id,
            )
            .where(
                ValidationRuleTemplateReference.template_id == template_id,
                ValidationRuleTemplateReference.variable_name == variable_name,
            )
        )
        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def create_reference(self, data: dict[str, Any]) -> ValidationRuleTemplateReference:
        reference = ValidationRuleTemplateReference(**data)
        self.session.add(reference)
        await self.session.flush()
        return reference

    async def delete_reference(self, reference: ValidationRuleTemplateReference) -> None:
        await self.session.delete(reference)
