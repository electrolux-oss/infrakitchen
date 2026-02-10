from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import (
    BatchOperationCreate,
    BatchOperationEntityIdsPatch,
    BatchOperationResponse,
)
from .dependencies import get_batch_operation_service
from .service import BatchOperationService

router = APIRouter()


@router.get(
    "/batch_operations/{batch_operation_id}",
    response_model=BatchOperationResponse,
    response_description="Get one batch operation by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(
    batch_operation_id: str,
    service: BatchOperationService = Depends(get_batch_operation_service),
):
    entity = await service.get_by_id(batch_operation_id=batch_operation_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Batch operation not found")
    return entity


@router.get(
    "/batch_operations",
    response_model=list[dict[str, Any]],
    response_description="Get all batch operations",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: BatchOperationService = Depends(get_batch_operation_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))

    headers = {"Content-Range": f"batch_operations 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/batch_operations",
    response_model=BatchOperationResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request,
    body: BatchOperationCreate,
    service: BatchOperationService = Depends(get_batch_operation_service),
):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(batch_operation=body, requester=requester)

    return entity


@router.patch(
    "/batch_operations/{batch_operation_id}/entity_ids",
    response_model=BatchOperationResponse,
    status_code=http_status.HTTP_200_OK,
)
async def patch_entity_ids(
    request: Request,
    batch_operation_id: str,
    body: BatchOperationEntityIdsPatch,
    service: BatchOperationService = Depends(get_batch_operation_service),
):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    if body.action not in await service.get_actions(batch_operation_id=batch_operation_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch_entity_ids(batch_operation_id=batch_operation_id, body=body, requester=requester)
    return entity


@router.delete(
    "/batch_operations/{batch_operation_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
async def delete(
    request: Request,
    batch_operation_id: str,
    service: BatchOperationService = Depends(get_batch_operation_service),
):
    requester: UserDTO = request.state.user
    await service.delete(batch_operation_id=batch_operation_id, requester=requester)


@router.get(
    "/batch_operations/{batch_operation_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(
    request: Request, batch_operation_id: str, service: BatchOperationService = Depends(get_batch_operation_service)
):
    requester = request.state.user
    return await service.get_actions(batch_operation_id=batch_operation_id, requester=requester)
