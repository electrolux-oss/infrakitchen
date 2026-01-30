from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status

from .dependencies import get_validation_rule_service
from .schema import ValidationRuleResponse
from .service import ValidationRuleService

router = APIRouter()


@router.get(
    "/validation-rules",
    response_model=list[ValidationRuleResponse],
    response_description="List validation rules filtered by entity name",
    status_code=http_status.HTTP_200_OK,
)
async def list_validation_rules(
    entity: str | None = Query(default=None, description="Entity to filter by (e.g. resource)"),
    service: ValidationRuleService = Depends(get_validation_rule_service),
):
    return await service.list_rules(entity_name=entity)
