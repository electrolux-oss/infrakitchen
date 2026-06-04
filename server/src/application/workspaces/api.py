from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.constants.model import ModelActions
from core.permissions.dependencies import get_permission_service
from core.permissions.schema import EntityPolicyCreate, PermissionResponse
from core.permissions.service import PermissionService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import WorkspaceCreate, WorkspaceResponse, WorkspaceUpdate
from .schema import (
    RoleWorkspacesResponse,
    UserWorkspaceResponse,
)
from .dependencies import get_workspace_service
from .service import WorkspaceService

router = APIRouter()


@router.get(
    "/workspaces/{workspace_id}",
    response_model=WorkspaceResponse,
    response_description="Get one workspace by id",
    status_code=http_status.HTTP_200_OK,
    deprecated=True,
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
    deprecated=True,
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


@router.patch(
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
    deprecated=True,
)
async def get_actions(request: Request, workspace_id: str, service: WorkspaceService = Depends(get_workspace_service)):
    requester = request.state.user
    return await service.get_actions(workspace_id=workspace_id, requester=requester)


# Permissions
@router.get(
    "/workspaces/permissions/user/{user_id}/policies",
    response_model=list[UserWorkspaceResponse],
    response_description="Get user workspace policies",
    status_code=http_status.HTTP_200_OK,
    deprecated=True,
)
async def get_user_workspaces(user_id: str, service: WorkspaceService = Depends(get_workspace_service)):
    return await service.get_user_workspace_policies(user_id)


@router.get(
    "/workspaces/permissions/role/{role_name}/policies",
    response_model=list[RoleWorkspacesResponse],
    response_description="Get role policies",
    status_code=http_status.HTTP_200_OK,
    deprecated=True,
)
async def get_workspace_role_permissions(
    response: Response,
    role_name: str,
    service: WorkspaceService = Depends(get_workspace_service),
    permission_service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    _, range_, sort, _ = query_parts

    total = await permission_service.count(filter={"v0": role_name, "ptype": "p", "v1__like": "workspace:"})

    if total == 0:
        result = []
    else:
        result = await service.get_role_permissions(role_name, range=range_, sort=sort)
    headers = {"Content-Range": f"policies 0-{len(result)}/{total}"}
    response.headers.update(headers)

    return result


@router.post(
    "/workspaces/permissions",
    response_model=list[PermissionResponse],
    response_description="Create workspace policy",
    status_code=http_status.HTTP_201_CREATED,
)
async def create_role_workspace_permissions(
    request: Request,
    workspace_policy: EntityPolicyCreate,
    service: WorkspaceService = Depends(get_workspace_service),
):
    requester: UserDTO = request.state.user

    requester_permissions = await user_entity_permissions(requester, workspace_policy.entity_id, "workspace")
    if "admin" not in requester_permissions:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.create_workspace_policy(workspace_policy, requester=requester)
