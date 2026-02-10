from fastapi import APIRouter, Depends, HTTPException, Request, status

from core.users.model import UserDTO

from .dependencies import get_validation_rule_service
from .service import ValidationRuleService
from .schema import (
    ValidationRuleResponse,
    ValidationRuleTemplateReference,
    ValidationRuleTemplateReferenceCreate,
    ValidationRuleTemplateReferenceReplace,
)

router = APIRouter()


@router.get(
    "/validation_rules/template/{template_id}",
    response_model=list[ValidationRuleResponse],
    response_description="List of effective validation rules for the specified template",
    status_code=status.HTTP_200_OK,
)
async def get_template_rules(
    template_id: str,
    variable_name: str | None = None,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> list[ValidationRuleResponse]:
    """Retrieve validation rules for a template, optionally filtered by variable name."""

    if variable_name:
        return await service.get_rules_for_variable(template_id=template_id, variable_name=variable_name)
    return await service.get_rules_for_template(template_id=template_id)


@router.post(
    "/validation_rules/template/{template_id}",
    response_model=ValidationRuleTemplateReference,
    response_description="The created validation rule reference",
    status_code=status.HTTP_201_CREATED,
)
async def create_template_rule(
    request: Request,
    template_id: str,
    body: ValidationRuleTemplateReferenceCreate,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> ValidationRuleTemplateReference:
    """Create a new validation rule reference for a template variable."""

    requester: UserDTO | None = request.state.user
    if requester is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    if str(body.template_id) != template_id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Template id mismatch")

    reference = await service.add_rule_for_template(
        template_id=template_id,
        variable_name=body.variable_name,
        rule_id=str(body.validation_rule_id),
        requester=requester,
    )
    return reference


@router.put(
    "/validation_rules/template/{template_id}/{variable_name}",
    response_model=list[ValidationRuleTemplateReference],
    response_description="Replaced validation rule references for the variable",
    status_code=status.HTTP_200_OK,
)
async def replace_template_rules(
    request: Request,
    template_id: str,
    variable_name: str,
    body: ValidationRuleTemplateReferenceReplace,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> list[ValidationRuleTemplateReference]:
    """Replace all validation rules assigned to a template variable."""

    requester: UserDTO | None = request.state.user
    if requester is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    rule_ids = [str(rule_id) for rule_id in body.rule_ids]
    references = await service.replace_rules_for_variable(
        template_id=template_id,
        variable_name=variable_name,
        rule_ids=rule_ids,
        requester=requester,
    )
    return references


@router.delete(
    "/validation_rules/template/{template_id}/{variable_name}/{reference_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_template_rule(
    request: Request,
    template_id: str,
    variable_name: str,
    reference_id: str,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> None:
    """Remove a validation rule reference from a template variable."""

    requester: UserDTO | None = request.state.user
    if requester is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    await service.delete_rule_reference(template_id=template_id, variable_name=variable_name, reference_id=reference_id)
