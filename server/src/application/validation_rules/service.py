import logging
from collections import defaultdict
from collections.abc import Sequence
from uuid import UUID

from .crud import ValidationRuleCRUD
from .schema import (
    ValidationRuleBase,
    ValidationRuleResponse,
    ValidationRuleTemplateReference,
)
from core.errors import EntityNotFound
from core.users.model import UserDTO


logger = logging.getLogger(__name__)


class ValidationRuleService:
    """
    ValidationRuleService is responsible for handling business logic related to validation rules.
    """

    def __init__(self, crud: ValidationRuleCRUD):
        self.crud = crud

    async def get_all_rules(self) -> list[ValidationRuleResponse]:
        """
        Retrieve all validation rules in the system.
        """
        rules = await self.crud.get_all_rules()
        return [ValidationRuleResponse.model_validate(rule) for rule in rules]

    async def get_rules_for_template(self, template_id: str | UUID) -> list[ValidationRuleResponse]:
        """
        Retrieve all validation rules associated with a given template ID.
        """
        rules = await self.crud.get_rules_by_template(template_id=template_id)
        return [ValidationRuleResponse.model_validate(rule) for rule in rules]

    async def get_rules_for_variable(self, template_id: str | UUID, variable_name: str) -> list[ValidationRuleResponse]:
        """
        Retrieve all validation rules associated with a specific variable in a template.
        """
        rules = await self.crud.get_rules_by_template_and_variable(template_id=template_id, variable_name=variable_name)
        return [ValidationRuleResponse.model_validate(rule) for rule in rules]

    async def get_rules_map_for_template(self, template_id: str | UUID) -> dict[str, list[ValidationRuleResponse]]:
        """Return validation rules grouped by template variable name."""
        references = await self.crud.get_references_by_template(template_id)
        rules_map: dict[str, list[ValidationRuleResponse]] = defaultdict(list)

        for reference in references:
            if reference.validation_rule is None:
                logger.warning("Validation rule reference %s is missing validation rule relationship", reference.id)
                continue
            parsed_rule = ValidationRuleResponse.model_validate(reference.validation_rule)
            rules_map[reference.variable_name].append(parsed_rule)

        return {key: value for key, value in rules_map.items()}

    async def create_rule(self, rule: ValidationRuleBase, requester: UserDTO) -> ValidationRuleResponse:
        """
        Create a new validation rule based on the provided data.
        """
        body = rule.model_dump(exclude_unset=True)
        body["created_by"] = requester.id
        new_rule = await self.crud.create_rule(data=body)
        return ValidationRuleResponse.model_validate(new_rule)

    async def update_rule(self, rule_id: str | UUID, rule: ValidationRuleBase) -> ValidationRuleResponse:
        """
        Update an existing validation rule with new data.
        """
        existing_rule = await self.crud.get_rule_by_id(rule_id=rule_id)
        if not existing_rule:
            raise EntityNotFound(f"Validation rule with ID {rule_id} not found.")

        body = rule.model_dump(exclude_unset=True)
        updated_rule = await self.crud.update_rule(existing_rule, data=body)
        return ValidationRuleResponse.model_validate(updated_rule)

    async def delete_rule(self, rule_id: str | UUID) -> None:
        """
        Delete a validation rule by its ID.
        """
        existing_rule = await self.crud.get_rule_by_id(rule_id=rule_id)
        if not existing_rule:
            raise EntityNotFound(f"Validation rule with ID {rule_id} not found.")

        await self.crud.delete_rule(existing_rule)

    async def replace_rules_for_variable(
        self, template_id: str | UUID, variable_name: str, rule_ids: Sequence[str | UUID], requester: UserDTO
    ) -> list[ValidationRuleTemplateReference]:
        """
        Replace all validation rules for a specific variable in a template with a new set of rules.
        """
        # Delete existing rule references for the variable
        existing_references = await self.crud.get_references_by_template_and_variable(
            template_id=template_id, variable_name=variable_name
        )
        for reference in existing_references:
            await self.crud.delete_reference(reference)

        # Create new rule references
        created_references = []
        for rule_id in rule_ids:
            rule = await self.crud.get_rule_by_id(rule_id=rule_id)
            if not rule:
                raise EntityNotFound(f"Validation rule with ID {rule_id} not found.")
            body = {
                "template_id": template_id,
                "variable_name": variable_name,
                "validation_rule_id": rule_id,
                "created_by": requester.id,
            }
            new_reference = await self.crud.create_reference(data=body)
            created_references.append(new_reference)

        return [ValidationRuleTemplateReference.model_validate(reference) for reference in created_references]

    async def add_rule_for_template(
        self, template_id: str | UUID, variable_name: str, rule_id: str | UUID, requester: UserDTO
    ) -> ValidationRuleTemplateReference:
        """
        Add a new validation rule to a specific template.
        """
        rule = await self.crud.get_rule_by_id(rule_id=rule_id)
        if not rule:
            raise EntityNotFound(f"Validation rule with ID {rule_id} not found.")

        body = {
            "template_id": template_id,
            "variable_name": variable_name,
            "validation_rule_id": rule_id,
            "created_by": requester.id,
        }
        reference = await self.crud.create_reference(data=body)
        return ValidationRuleTemplateReference.model_validate(reference)

    async def delete_rule_reference(
        self, template_id: str | UUID, variable_name: str, reference_id: str | UUID
    ) -> None:
        reference = await self.crud.get_reference_by_id(reference_id)
        if reference is None:
            raise EntityNotFound(f"Validation rule reference with ID {reference_id} not found.")

        template_identifier = str(template_id)
        if str(reference.template_id) != template_identifier or reference.variable_name != variable_name:
            raise EntityNotFound("Validation rule reference not found for the provided template or variable.")

        await self.crud.delete_reference(reference)
