from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status

from application.templates.schema import TemplateResponse
from application.use_cases.create_template_with_scv.dependencies import get_template_with_scv_service
from application.use_cases.create_template_with_scv.schema import TemplateCreateWithSCV
from application.use_cases.create_template_with_scv.service import TemplateWithSCVService
from core.users.model import UserDTO


router = APIRouter()


@router.post(
    "/create_template_with_scv",
    response_model=TemplateResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request,
    body: TemplateCreateWithSCV,
    service: TemplateWithSCVService = Depends(get_template_with_scv_service),
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(template_with_scv=body, requester=requester)
    return entity
