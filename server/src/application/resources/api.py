from typing import Any, Literal
from application.resources.service import ResourceService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.functions import user_has_access_to_resource
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import (
    ResourceCreate,
    ResourceResponse,
    ResourceTreeResponse,
    ResourcePatch,
)
from .dependencies import get_resource_service

router = APIRouter()


@router.get(
    "/resources/{resource_id}",
    response_model=ResourceResponse,
    response_description="Get one resource by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(resource_id: str, service: ResourceService = Depends(get_resource_service)):
    entity = await service.get_by_id(resource_id=resource_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return entity


@router.get(
    "/resources",
    response_model=list[dict[str, Any]],
    response_description="Get all resources",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: ResourceService = Depends(get_resource_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"resources 0-{len(result)}/{total}"}
    response.headers.update(headers)
    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/resources",
    response_model=ResourceResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: ResourceCreate, service: ResourceService = Depends(get_resource_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(resource=body, requester=requester)

    return entity


@router.patch(
    "/resources/{resource_id}",
    response_model=ResourceResponse,
    status_code=http_status.HTTP_200_OK,
)
async def patch(
    request: Request,
    resource_id: str,
    body: ResourcePatch,
    service: ResourceService = Depends(get_resource_service),
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, resource_id, action="write"):
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.patch(resource_id=resource_id, resource=body, requester=requester)
    return entity


@router.patch("/resources/{resource_id}/actions", response_model=ResourceResponse, status_code=http_status.HTTP_200_OK)
async def patch_action(
    request: Request,
    resource_id: str,
    body: PatchBodyModel,
    service: ResourceService = Depends(get_resource_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))
    if not await user_has_access_to_resource(requester, resource_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    entity = await service.patch_action(resource_id=resource_id, body=body, requester=requester)

    return entity


@router.delete("/resources/{resource_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, resource_id: str, service: ResourceService = Depends(get_resource_service)):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, resource_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(resource_id=resource_id, requester=requester)


@router.get(
    "/resources/{resource_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, resource_id: str, service: ResourceService = Depends(get_resource_service)):
    requester = request.state.user
    return await service.get_actions(resource_id=resource_id, requester=requester)


@router.get(
    "/resources/{resource_id}/tree/{direction}",
    response_model=ResourceTreeResponse,
    response_description="Get tree for a resource",
    status_code=http_status.HTTP_200_OK,
)
async def get_tree(
    resource_id: str,
    direction: Literal["parents", "children"],
    service: ResourceService = Depends(get_resource_service),
):
    tree = await service.get_tree(resource_id=resource_id, direction=direction)
    return tree


@router.get(
    "/resources/{resource_id}/metadata",
    response_description="Get metadata from cloud provider for a single resource",
    response_model_by_alias=False,
)
async def get_metadata(
    resource_id: str,
    service: ResourceService = Depends(get_resource_service),
):
    metadata = await service.metadata(resource_id=resource_id)
    return metadata
