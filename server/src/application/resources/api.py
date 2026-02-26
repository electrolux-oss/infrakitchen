from typing import Any, Literal
from application.resources.service import ResourceService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.permissions.dependencies import get_permission_service
from core.permissions.schema import EntityPolicyCreate, PermissionResponse
from core.permissions.service import PermissionService
from core.users.functions import user_entity_permissions
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from .schema import (
    ResourceCreate,
    ResourceResponse,
    ResourceTreeResponse,
    ResourcePatch,
    RoleResourcesResponse,
    UserResourceResponse,
)
from .dependencies import get_resource_service

router = APIRouter()


@router.get(
    "/resources/{resource_id}",
    response_model=ResourceResponse,
    response_description="Get one resource by id",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "resources", param_renames={"id": "resource_id"})
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
@mcp_group(list_entities_group, "resources")
async def get_all(
    request: Request,
    response: Response,
    service: ResourceService = Depends(get_resource_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    requester: UserDTO | None = getattr(request.state, "user", None)
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(
            await service.get_all(
                filter=filter,
                range=range_,
                sort=sort,
                requester_id=requester.id if requester else None,
            )
        )
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
    if ModelActions.EDIT not in await service.get_actions(resource_id=resource_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")
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
    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(resource_id=resource_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch_action(resource_id=resource_id, body=body, requester=requester)

    return entity


@router.delete("/resources/{resource_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, resource_id: str, service: ResourceService = Depends(get_resource_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(resource_id=resource_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")
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


@router.patch(
    "/resources/{resource_id}/sync",
    response_model=ResourceResponse,
    status_code=http_status.HTTP_200_OK,
)
async def sync_workspace(
    request: Request,
    resource_id: str,
    service: ResourceService = Depends(get_resource_service),
):
    requester: UserDTO = request.state.user

    if ModelActions.EDIT not in await service.get_actions(resource_id=resource_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")

    entity = await service.sync_workspace(resource_id=resource_id, requester=requester)
    return entity


# Permissions
@router.get(
    "/resources/permissions/user/{user_id}/policies",
    response_model=list[UserResourceResponse],
    response_description="Get user resource policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_user_resources(user_id: str, service: ResourceService = Depends(get_resource_service)):
    resources = await service.get_user_resource_policies(user_id)
    return resources


@router.get(
    "/resources/permissions/role/{role_name}/policies",
    response_model=list[RoleResourcesResponse],
    response_description="Get role policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_resource_role_permissions(
    response: Response,
    role_name: str,
    service: ResourceService = Depends(get_resource_service),
    permission_service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    _, range_, sort, _ = query_parts

    total = await permission_service.count(filter={"v0": role_name, "ptype": "p", "v1__like": "resource:"})

    if total == 0:
        result = []
    else:
        result = await service.get_role_permissions(role_name, range=range_, sort=sort)
    headers = {"Content-Range": f"policies 0-{len(result)}/{total}"}
    response.headers.update(headers)

    return result


@router.post(
    "/resources/permissions",
    response_model=list[PermissionResponse],
    response_description="Sync role permissions with resources",
    status_code=http_status.HTTP_201_CREATED,
)
async def create_role_resource_permissions(
    request: Request,
    resource_policy: EntityPolicyCreate,
    service: ResourceService = Depends(get_resource_service),
):
    requester: UserDTO = request.state.user

    requester_permissions = await user_entity_permissions(requester, resource_policy.entity_id, "resource")
    if "admin" not in requester_permissions:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.create_resource_policy(resource_policy, requester=requester)
