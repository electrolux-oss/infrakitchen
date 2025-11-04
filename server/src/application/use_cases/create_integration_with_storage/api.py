from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi import status as http_status

from application.integrations.schema import IntegrationResponse
from application.use_cases.create_integration_with_storage.dependencies import get_integration_with_storage_service
from application.use_cases.create_integration_with_storage.schema import IntegrationCreateWithStorage
from application.use_cases.create_integration_with_storage.service import IntegrationWithStorageService
from core.users.model import UserDTO


router = APIRouter()


@router.post(
    "/create_integration_with_storage",
    response_model=IntegrationResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request,
    body: IntegrationCreateWithStorage,
    service: IntegrationWithStorageService = Depends(get_integration_with_storage_service),
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(integration_with_storage=body, requester=requester)
    return entity
