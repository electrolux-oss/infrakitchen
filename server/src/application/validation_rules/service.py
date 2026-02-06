import re
from collections.abc import Iterable
from uuid import UUID

from application.templates.service import TemplateService
from core.errors import EntityNotFound
from core.users.model import UserDTO

from .crud import ValidationRuleCRUD
from .model import ValidationRule, ValidationRuleTargetType
from .schema import (
    ValidationRuleCreate,
    ValidationRuleResponse,
    ValidationRuleUpdate,
)


class ValidationRuleService:
    def __init__(self, crud: ValidationRuleCRUD, template_service: TemplateService):
        self.crud = crud
        self.template_service = template_service

    async def get_effective_rules_for_template(self, template_id: UUID) -> list[ValidationRuleResponse]:
        await self._ensure_template_exists(template_id)

        references = await self.crud.get_references_by_template(template_id)
        responses = [
            self._to_response(
                reference.validation_rule,
                template_id=reference.template_id,
                variable_name=reference.variable_name,
            )
            for reference in references
        ]
        return sorted(responses, key=lambda rule: (rule.variable_name, rule.created_at))

    async def create_rule(self, rule: ValidationRuleCreate, requester: UserDTO) -> ValidationRuleResponse:
        await self._ensure_template_exists(rule.template_id)
        self._validate_rule_payload(rule)

        data = rule.model_dump(exclude_unset=True, exclude={"template_id", "variable_name"})
        data["created_by"] = requester.id
        created = await self.crud.create_rule(data)
        await self.crud.create_reference(
            {
                "template_id": rule.template_id,
                "variable_name": rule.variable_name,
                "validation_rule_id": created.id,
                "created_by": requester.id,
            }
        )
        return self._to_response(created, template_id=rule.template_id, variable_name=rule.variable_name)

    async def update_rule(self, rule: ValidationRuleUpdate) -> ValidationRuleResponse:
        await self._ensure_template_exists(rule.template_id)
        self._validate_rule_payload(rule)

        if not rule.id:
            raise ValueError("Rule ID is required for updates")

        existing = await self.crud.get_rule_by_id(rule.id)
        if existing is None:
            raise EntityNotFound("Validation rule not found")

        rules = await self.crud.get_rules_by_template_and_variable(rule.template_id, rule.variable_name)
        if not any(matching_rule.id == rule.id for matching_rule in rules):
            raise EntityNotFound("Validation rule reference not found for provided template and variable")

        data = rule.model_dump(exclude_unset=True, exclude={"id", "template_id", "variable_name"})
        updated = await self.crud.update_rule(existing, data)
        return self._to_response(updated, template_id=rule.template_id, variable_name=rule.variable_name)

    async def delete_rule(self, template_id: UUID, variable_name: str, rule_id: UUID | None = None) -> None:
        references = await self.crud.get_references_by_template_and_variable(template_id, variable_name)
        if rule_id is not None:
            references = [reference for reference in references if reference.validation_rule_id == rule_id]

        for reference in references:
            await self.crud.delete_reference(reference)
            await self.crud.delete_rule(reference.validation_rule)

    async def replace_rules_for_variable(
        self,
        template_id: UUID,
        variable_name: str,
        rules: Iterable[ValidationRuleCreate],
        requester: UserDTO,
    ) -> list[ValidationRuleResponse]:
        await self._ensure_template_exists(template_id)
        responses: list[ValidationRuleResponse] = []

        existing = await self.crud.get_references_by_template_and_variable(template_id, variable_name)
        for reference in existing:
            await self.crud.delete_reference(reference)
            await self.crud.delete_rule(reference.validation_rule)

        for rule in rules:
            if rule.template_id != template_id or rule.variable_name != variable_name:
                raise ValueError("Rule payload must match target template and variable")
            self._validate_rule_payload(rule)
            data = rule.model_dump(exclude_unset=True, exclude={"template_id", "variable_name"})
            data["created_by"] = requester.id
            created = await self.crud.create_rule(data)
            await self.crud.create_reference(
                {
                    "template_id": template_id,
                    "variable_name": variable_name,
                    "validation_rule_id": created.id,
                    "created_by": requester.id,
                }
            )
            responses.append(self._to_response(created, template_id=template_id, variable_name=variable_name))

        return responses

    async def _ensure_templates_exist(self, template_ids: Iterable[UUID]) -> None:
        template_ids = {tid for tid in template_ids if tid is not None}
        if not template_ids:
            return
        templates = await self.template_service.get_all(filter={"id": list(template_ids)})
        found_ids = {template.id for template in templates}
        missing = template_ids - found_ids
        if missing:
            raise EntityNotFound(f"Templates not found: {', '.join(str(template_id) for template_id in missing)}")

    async def _ensure_template_exists(self, template_id: UUID) -> None:
        await self._ensure_templates_exist([template_id])

    def _validate_rule_payload(self, rule: ValidationRuleCreate | ValidationRuleUpdate) -> None:
        if rule.target_type == ValidationRuleTargetType.STRING:
            if rule.min_value is not None or rule.max_value is not None:
                raise ValueError("min_value and max_value are only supported for numeric validation rules")
            if rule.regex_pattern:
                try:
                    re.compile(rule.regex_pattern)
                except re.error as error:
                    raise ValueError("Invalid regular expression pattern") from error
            if not rule.regex_pattern:
                raise ValueError("String validation rules require a regex_pattern")
        elif rule.target_type == ValidationRuleTargetType.NUMBER:
            if rule.regex_pattern is not None:
                raise ValueError("regex_pattern is only supported for string validation rules")
            if rule.min_value is None and rule.max_value is None:
                raise ValueError("Numeric validation rules require at least min_value or max_value")
            if rule.min_value is not None and rule.max_value is not None and rule.min_value > rule.max_value:
                raise ValueError("min_value cannot be greater than max_value")
        else:
            raise ValueError("Unsupported validation rule target type")

    def _to_response(
        self,
        rule: ValidationRule,
        template_id: UUID,
        variable_name: str,
    ) -> ValidationRuleResponse:
        return ValidationRuleResponse(
            id=rule.id,
            template_id=template_id,
            variable_name=variable_name,
            target_type=rule.target_type,
            min_value=rule.min_value,
            max_value=rule.max_value,
            regex_pattern=rule.regex_pattern,
            created_at=rule.created_at,
            updated_at=rule.updated_at,
        )
