import uuid

import strawberry
from strawberry.experimental import pydantic as strawberry_pydantic
from strawberry.types import Info

from application.validation_rules.dependencies import get_validation_rule_service
from application.validation_rules.schema import ValidationRuleBase, ValidationRuleTemplateReference
from graphql_api.helpers import IsAuthenticated
from graphql_api.modules.validation_rule.types import ValidationRuleTemplateReferenceType


@strawberry_pydantic.input(model=ValidationRuleBase, all_fields=True)
class ValidationRuleInput:
    pass


def _map_reference(reference: ValidationRuleTemplateReference) -> ValidationRuleTemplateReferenceType:
    return ValidationRuleTemplateReferenceType(
        id=reference.id,
        template_id=reference.template_id,
        variable_name=reference.variable_name,
        validation_rule_id=reference.validation_rule_id,
        created_at=reference.created_at,
        updated_at=reference.updated_at,
    )


@strawberry.type
class ValidationRuleMutation:
    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def add_validation_rule(
        self,
        info: Info,
        template_id: uuid.UUID,
        variable_name: str,
        rule: ValidationRuleInput,
    ) -> ValidationRuleTemplateReferenceType:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_validation_rule_service(session)

        reference = await service.add_rule_for_template(
            template_id=template_id,
            variable_name=variable_name,
            rule=rule.to_pydantic(),
            requester=requester,
        )
        return _map_reference(reference)

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def replace_validation_rules(
        self,
        info: Info,
        template_id: uuid.UUID,
        variable_name: str,
        rules: list[ValidationRuleInput],
    ) -> list[ValidationRuleTemplateReferenceType]:
        session = info.context["session"]
        requester = info.context["request"].state.user
        service = get_validation_rule_service(session)

        references = await service.replace_rules_for_variable(
            template_id=template_id,
            variable_name=variable_name,
            rules=[rule.to_pydantic() for rule in rules],
            requester=requester,
        )
        return [_map_reference(reference) for reference in references]

    @strawberry.mutation(permission_classes=[IsAuthenticated])
    async def delete_validation_rule(
        self,
        info: Info,
        template_id: uuid.UUID,
        variable_name: str,
        reference_id: uuid.UUID,
    ) -> bool:
        session = info.context["session"]
        service = get_validation_rule_service(session)

        await service.delete_rule_reference(
            template_id=template_id,
            variable_name=variable_name,
            reference_id=reference_id,
        )
        return True
