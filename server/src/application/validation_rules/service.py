import re
from collections.abc import Sequence
from collections.abc import Iterable
from uuid import UUID

from application.templates.service import TemplateService
from core.errors import EntityExistsError, EntityNotFound
from core.users.model import UserDTO

from .crud import ValidationRuleCRUD
from .model import ValidationRule, ValidationRuleTargetType, ValidationRuleTemplateReference
from .schema import (
    ValidationRuleCreate,
    ValidationRuleReferenceCreate,
    ValidationRuleReferenceResponse,
    ValidationRuleResponse,
    ValidationRuleUpdate,
)


class ValidationRuleService:
    def __init__(self, crud: ValidationRuleCRUD, template_service: TemplateService):
        self.crud = crud
        self.template_service = template_service

    async def get_effective_rules_for_template(self, template_id: UUID) -> list[ValidationRuleResponse]:
        template = await self.template_service.get_by_id(template_id)
        if not template:
            raise EntityNotFound("Template not found")

        direct_rules = await self.crud.get_rules_by_template(template_id)
        references = await self.crud.get_references_by_template(template_id)

        responses = [
            self._to_response(rule, target_template_id=template_id, inherited_from=None) for rule in direct_rules
        ]
        if not references:
            return sorted(responses, key=lambda rule: rule.variable_name)

        referenced_rules = await self._load_referenced_rules(references)
        direct_variables = {rule.variable_name for rule in direct_rules}

        for reference in references:
            if reference.variable_name in direct_variables:
                continue
            key = (reference.reference_template_id, reference.variable_name)
            rule = referenced_rules.get(key)
            if not rule:
                raise EntityNotFound(
                    f"Validation rule for variable '{reference.variable_name}' "
                    + f"not found in template {reference.reference_template_id}"
                )
            responses.append(
                self._to_response(rule, target_template_id=template_id, inherited_from=reference.reference_template_id)
            )

        return sorted(responses, key=lambda rule: rule.variable_name)

    async def create_rule(self, rule: ValidationRuleCreate, requester: UserDTO) -> ValidationRuleResponse:
        await self._ensure_template_exists(rule.template_id)
        self._validate_rule_payload(rule)

        existing = await self.crud.get_rule_by_template_and_name(rule.template_id, rule.variable_name)
        if existing:
            raise EntityExistsError("Validation rule already exists for this variable")

        data = rule.model_dump(exclude_unset=True)
        data["created_by"] = requester.id
        created = await self.crud.create_rule(data)
        return self._to_response(created)

    async def update_rule(self, rule: ValidationRuleUpdate) -> ValidationRuleResponse:
        await self._ensure_template_exists(rule.template_id)
        self._validate_rule_payload(rule)

        existing = None
        if rule.id:
            existing = await self.crud.get_rule_by_id(rule.id)
        if existing is None:
            existing = await self.crud.get_rule_by_template_and_name(rule.template_id, rule.variable_name)

        if not existing:
            raise EntityNotFound("Validation rule not found")

        if existing.template_id != rule.template_id:
            raise ValueError("template_id cannot be changed for an existing validation rule")

        if existing.variable_name != rule.variable_name:
            conflict = await self.crud.get_rule_by_template_and_name(rule.template_id, rule.variable_name)
            if conflict and conflict.id != existing.id:
                raise EntityExistsError("Validation rule already exists for this variable")

        data = rule.model_dump(exclude_unset=True, exclude={"id"})
        updated = await self.crud.update_rule(existing, data)
        return self._to_response(updated)

    async def delete_rule(self, template_id: UUID, variable_name: str) -> None:
        existing = await self.crud.get_rule_by_template_and_name(template_id, variable_name)
        if existing:
            await self.crud.delete_rule(existing)

    async def upsert_references(
        self, references: Sequence[ValidationRuleReferenceCreate]
    ) -> list[ValidationRuleReferenceResponse]:
        if not references:
            return []

        # validate templates in batch
        templates_to_check = {ref.template_id for ref in references}
        templates_to_check.update({ref.reference_template_id for ref in references if ref.reference_template_id})
        await self._ensure_templates_exist(templates_to_check)

        responses: list[ValidationRuleReferenceResponse] = []
        for reference in references:
            if reference.reference_template_id is None:
                existing = await self.crud.get_reference_by_template_and_variable(
                    reference.template_id, reference.variable_name
                )
                if existing:
                    await self.crud.delete_reference(existing)
                continue

            source_rule = await self.crud.get_rule_by_template_and_name(
                reference.reference_template_id, reference.variable_name
            )
            if not source_rule:
                raise EntityNotFound(
                    f"Validation rule for variable '{reference.variable_name}' "
                    + f"not found in template {reference.reference_template_id}"
                )

            existing = await self.crud.get_reference_by_template_and_variable(
                reference.template_id, reference.variable_name
            )
            data = reference.model_dump(exclude_unset=True)
            if existing:
                updated = await self.crud.update_reference(existing, data)
                responses.append(ValidationRuleReferenceResponse.model_validate(updated))
            else:
                created = await self.crud.create_reference(data)
                responses.append(ValidationRuleReferenceResponse.model_validate(created))

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
        target_template_id: UUID | None = None,
        inherited_from: UUID | None = None,
    ) -> ValidationRuleResponse:
        template_id = target_template_id or rule.template_id
        return ValidationRuleResponse(
            id=rule.id,
            template_id=template_id,
            variable_name=rule.variable_name,
            target_type=rule.target_type,
            min_value=rule.min_value,
            max_value=rule.max_value,
            regex_pattern=rule.regex_pattern,
            inherited_from_template_id=inherited_from,
            created_at=rule.created_at,
            updated_at=rule.updated_at,
        )

    async def _load_referenced_rules(
        self, references: Sequence[ValidationRuleTemplateReference]
    ) -> dict[tuple[UUID, str], ValidationRule]:
        template_ids = {reference.reference_template_id for reference in references}
        if not template_ids:
            return {}
        rules = await self.crud.get_rules_by_template_ids(template_ids)
        return {(rule.template_id, rule.variable_name): rule for rule in rules}
