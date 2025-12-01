from typing import Any
from application.secrets.service import SecretService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.functions import user_has_access_to_resource
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import SecretCreate, SecretResponse, SecretUpdate, SecretValidationResponse
from .dependencies import get_secret_service

router = APIRouter()


@router.get(
    "/secrets/{secret_id}",
    response_model=SecretResponse,
    response_description="Get one secret by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(secret_id: str, service: SecretService = Depends(get_secret_service)):
    entity = await service.get_by_id(secret_id=secret_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Secret not found")
    return entity


@router.get(
    "/secrets",
    response_model=list[dict[str, Any]],
    response_description="Get all secrets",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: SecretService = Depends(get_secret_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"secrets 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/secrets",
    response_model=SecretResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: SecretCreate, service: SecretService = Depends(get_secret_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(secret=body, requester=requester)

    return entity


@router.patch(
    "/secrets/{secret_id}",
    response_model=SecretResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    secret_id: str,
    body: SecretUpdate,
    service: SecretService = Depends(get_secret_service),
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, secret_id, action="write"):
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.update(secret_id=secret_id, secret=body, requester=requester)
    return entity


@router.patch("/secrets/{secret_id}/actions", response_model=SecretResponse, status_code=http_status.HTTP_200_OK)
async def patch_action(
    request: Request,
    secret_id: str,
    body: PatchBodyModel,
    service: SecretService = Depends(get_secret_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))
    if not await user_has_access_to_resource(requester, secret_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    entity = await service.patch_action(secret_id=secret_id, body=body, requester=requester)

    return entity


@router.delete("/secrets/{secret_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, secret_id: str, service: SecretService = Depends(get_secret_service)):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, secret_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(secret_id=secret_id, requester=requester)


@router.get(
    "/secrets/{secret_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, secret_id: str, service: SecretService = Depends(get_secret_service)):
    requester = request.state.user
    return await service.get_actions(secret_id=secret_id, requester=requester)


@router.post(
    "/secrets/validate",
    response_model=SecretValidationResponse,
    status_code=http_status.HTTP_200_OK,
)
async def validate_on_create(body: SecretCreate, service: SecretService = Depends(get_secret_service)):
    return await service.validate(secret=body)


@router.get(
    "/secrets/{secret_id}/validate",
    response_model=SecretValidationResponse,
    status_code=http_status.HTTP_200_OK,
)
async def validate(secret_id: str, service: SecretService = Depends(get_secret_service)):
    secret = await service.get_by_id(secret_id=secret_id)
    if not secret:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Secret not found")
    return await service.validate(secret)
