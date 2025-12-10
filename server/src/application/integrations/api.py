from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from application.integrations.service import IntegrationService
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.users.functions import user_has_access_to_api
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .dependencies import get_integration_service
from .schema import (
    IntegrationCreate,
    IntegrationResponse,
    IntegrationUpdate,
    IntegrationValidationResponse,
    IntegrationValidationRequest,
)

router = APIRouter()


@router.get(
    "/integrations/{integration_id}",
    response_model=IntegrationResponse,
    response_description="Get one integration by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(integration_id: str, service: IntegrationService = Depends(get_integration_service)):
    entity = await service.get_by_id(integration_id=integration_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Integration not found")
    return entity


@router.get(
    "/integrations",
    response_model=list[IntegrationResponse],
    response_description="Get all integrations",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: IntegrationService = Depends(get_integration_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"integrations 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result


@router.post(
    "/integrations",
    response_model=IntegrationResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request, body: IntegrationCreate, service: IntegrationService = Depends(get_integration_service)
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(integration=body, requester=requester)

    return entity


@router.patch(
    "/integrations/{integration_id}",
    response_model=IntegrationResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    integration_id: str,
    body: IntegrationUpdate,
    service: IntegrationService = Depends(get_integration_service),
):
    requester: UserDTO = request.state.user
    if ModelActions.EDIT not in await service.get_actions(integration_id=integration_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")
    entity = await service.update(integration_id=integration_id, integration=body, requester=requester)
    return entity


@router.patch(
    "/integrations/{integration_id}/actions", response_model=IntegrationResponse, status_code=http_status.HTTP_200_OK
)
async def patch_action(
    request: Request,
    integration_id: str,
    body: PatchBodyModel,
    service: IntegrationService = Depends(get_integration_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))
    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(integration_id=integration_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")
    entity = await service.patch(integration_id=integration_id, body=body, requester=requester)

    return entity


@router.delete("/integrations/{integration_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, integration_id: str, service: IntegrationService = Depends(get_integration_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(integration_id=integration_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")
    await service.delete(integration_id=integration_id, requester=requester)


@router.get(
    "/integrations/{integration_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(
    request: Request, integration_id: str, service: IntegrationService = Depends(get_integration_service)
):
    requester = request.state.user
    return await service.get_actions(integration_id=integration_id, requester=requester)


@router.post(
    "/integrations/validate",
    response_model=IntegrationValidationResponse,
    status_code=http_status.HTTP_200_OK,
)
async def validate_on_create(
    request: Request, body: IntegrationValidationRequest, service: IntegrationService = Depends(get_integration_service)
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_api(requester, "integration", action="write"):
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.validate(integration_config=body.configuration, integration_provider=body.integration_provider)


@router.get(
    "/integrations/{integration_id}/validate",
    response_model=IntegrationValidationResponse,
    status_code=http_status.HTTP_200_OK,
)
async def validate(
    request: Request, integration_id: str, service: IntegrationService = Depends(get_integration_service)
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_api(requester, "integration", action="write"):
        raise HTTPException(status_code=403, detail="Access denied")

    integration = await service.get_by_id(integration_id=integration_id)
    if not integration:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Integration not found")
    return await service.validate(
        integration_config=integration.configuration, integration_provider=integration.integration_provider
    )
