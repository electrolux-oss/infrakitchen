from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from core.users.model import UserDTO

from .dependencies import get_validation_rule_service
from .schema import (
    ValidationRuleCreate,
    ValidationRuleReferenceCreate,
    ValidationRuleReferenceResponse,
    ValidationRuleResponse,
    ValidationRuleUpdate,
)
from .service import ValidationRuleService

router = APIRouter()


@router.get(
    "/validation_rules/template/{template_id}",
    response_model=list[ValidationRuleResponse],
    response_description="List of effective validation rules for the specified template",
    status_code=status.HTTP_200_OK,
)
async def get_template_rules(
    template_id: UUID,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> list[ValidationRuleResponse]:
    return await service.get_effective_rules_for_template(template_id)


@router.post(
    "/validation_rules",
    response_model=ValidationRuleResponse,
    response_description="The created validation rule",
    status_code=status.HTTP_201_CREATED,
)
async def create_validation_rule(
    request: Request,
    body: ValidationRuleCreate,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> ValidationRuleResponse:
    requester: UserDTO | None = request.state.user
    if requester is None:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    return await service.create_rule(body, requester)


@router.put(
    "/validation_rules",
    response_model=ValidationRuleResponse,
    response_description="The updated validation rule",
    status_code=status.HTTP_200_OK,
)
async def update_validation_rule(
    body: ValidationRuleUpdate,
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> ValidationRuleResponse:
    return await service.update_rule(body)


@router.post(
    "/validation_rules/references",
    response_model=list[ValidationRuleReferenceResponse],
    response_description="List of upserted validation rule references",
    status_code=status.HTTP_200_OK,
)
async def upsert_validation_rule_references(
    body: list[ValidationRuleReferenceCreate],
    service: ValidationRuleService = Depends(get_validation_rule_service),
) -> list[ValidationRuleReferenceResponse]:
    return await service.upsert_references(body)
