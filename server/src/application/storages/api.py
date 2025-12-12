from typing import Any
from application.storages.service import StorageService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import StorageCreate, StorageResponse, StorageUpdate
from .dependencies import get_storage_service

router = APIRouter()


@router.get(
    "/storages/{storage_id}",
    response_model=StorageResponse,
    response_description="Get one storage by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(storage_id: str, service: StorageService = Depends(get_storage_service)):
    entity = await service.get_by_id(storage_id=storage_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Storage not found")
    return entity


@router.get(
    "/storages",
    response_model=list[dict[str, Any]],
    response_description="Get all storages",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: StorageService = Depends(get_storage_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"storages 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/storages",
    response_model=StorageResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: StorageCreate, service: StorageService = Depends(get_storage_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(storage=body, requester=requester)

    return entity


@router.patch(
    "/storages/{storage_id}",
    response_model=StorageResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    storage_id: str,
    body: StorageUpdate,
    service: StorageService = Depends(get_storage_service),
):
    requester: UserDTO = request.state.user
    if ModelActions.EDIT not in await service.get_actions(storage_id=storage_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")

    entity = await service.update(storage_id=storage_id, storage=body, requester=requester)
    return entity


@router.patch("/storages/{storage_id}/actions", response_model=StorageResponse, status_code=http_status.HTTP_200_OK)
async def patch_action(
    request: Request,
    storage_id: str,
    body: PatchBodyModel,
    service: StorageService = Depends(get_storage_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))
    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(storage_id=storage_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch_action(storage_id=storage_id, body=body, requester=requester)

    return entity


@router.delete("/storages/{storage_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, storage_id: str, service: StorageService = Depends(get_storage_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(storage_id=storage_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")

    await service.delete(storage_id=storage_id, requester=requester)


@router.get(
    "/storages/{storage_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, storage_id: str, service: StorageService = Depends(get_storage_service)):
    requester = request.state.user
    return await service.get_actions(storage_id=storage_id, requester=requester)
