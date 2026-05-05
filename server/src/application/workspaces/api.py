from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.constants.model import ModelActions
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from .dependencies import get_workspace_service
from .service import WorkspaceService

router = APIRouter()


@router.get(
    "/workspaces/{workspace_id}",
    response_model=WorkspaceResponse,
    response_description="Get one workspace by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(workspace_id: str, service: WorkspaceService = Depends(get_workspace_service)):
    entity = await service.get_by_id(workspace_id=workspace_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Workspace not found")
    return entity


@router.get(
    "/workspaces",
    response_model=list[dict[str, Any]],
    response_description="Get all workspaces",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: WorkspaceService = Depends(get_workspace_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"workspaces 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/workspaces",
    response_model=WorkspaceResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: WorkspaceCreate, service: WorkspaceService = Depends(get_workspace_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(workspace=body, requester=requester)

    return entity


@router.put(
    "/workspaces/{workspace_id}",
    response_model=WorkspaceResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    workspace_id: str,
    body: WorkspaceUpdate,
    service: WorkspaceService = Depends(get_workspace_service),
):
    requester: UserDTO = request.state.user
    if ModelActions.EDIT not in await service.get_actions(workspace_id=workspace_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")

    entity = await service.update(workspace_id=workspace_id, workspace=body, requester=requester)
    return entity


@router.delete("/workspaces/{workspace_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, workspace_id: str, service: WorkspaceService = Depends(get_workspace_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(workspace_id=workspace_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")
    await service.delete(workspace_id=workspace_id)


@router.get(
    "/workspaces/{workspace_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, workspace_id: str, service: WorkspaceService = Depends(get_workspace_service)):
    requester = request.state.user
    return await service.get_actions(workspace_id=workspace_id, requester=requester)
