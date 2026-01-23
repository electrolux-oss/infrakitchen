from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.constants.model import ModelActions
from core.permissions.schema import (
    ApiPolicyCreate,
    EntityPolicyCreate,
    PermissionResponse,
    RoleUsersResponse,
    RoleCreate,
)
from core.users.functions import user_has_access_to_entity, user_is_super_admin
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from core.utils.model_tools import is_valid_uuid

from .service import PermissionService
from .dependencies import get_permission_service

router = APIRouter()


@router.get(
    "/permissions/roles",
    response_model=list[PermissionResponse],
    response_description="Get all roles",
    status_code=http_status.HTTP_200_OK,
)
async def get_all_roles(
    response: Response,
    service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, _, _ = query_parts

    total = await service.count_roles(filter=filter)

    if total == 0:
        roles = []
    else:
        roles = await service.get_all_roles(filter=filter, range=range_)

    headers = {"Content-Range": f"roles 0-{len(roles)}/{total}"}
    response.headers.update(headers)
    return roles


@router.get(
    "/permissions/{entity_id}",
    response_model=PermissionResponse,
    response_description="Get one role by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(entity_id: str, service: PermissionService = Depends(get_permission_service)):
    entity = await service.get_by_id(permission_id=entity_id)

    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role not found")

    return entity


# User permissions
@router.get(
    "/permissions/user/{user_id}/roles",
    response_model=list[PermissionResponse],
    response_description="Get user permissions",
    status_code=http_status.HTTP_200_OK,
)
async def get_user_roles(
    response: Response,
    user_id: str,
    service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    _, range_, _, _ = query_parts
    filter = {"ptype": "g", "v0": f"user:{user_id}"}

    total = await service.count(filter=filter)

    if total == 0:
        roles = []
    else:
        roles = await service.get_all(filter=filter, range=range_)

    headers = {"Content-Range": f"roles 0-{len(roles)}/{total}"}
    response.headers.update(headers)

    return roles


# Role permissions
@router.get(
    "/permissions/role/{role_name}/api/policies",
    response_model=list[PermissionResponse],
    response_description="Get role policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_role_api_permissions(
    response: Response,
    role_name: str,
    service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    _, range_, sort, _ = query_parts

    total = await service.count(filter={"v0": role_name, "ptype": "p", "v1__like": "api:"})

    if total == 0:
        result = []
    else:
        result = await service.get_role_api_permissions(role_name, range=range_, sort=sort)
    headers = {"Content-Range": f"policies 0-{len(result)}/{total}"}
    response.headers.update(headers)

    return result


# Users with assigned role
@router.get(
    "/permissions/role/{role_name}/users",
    response_model=list[RoleUsersResponse],
    response_description="Get users by role",
    status_code=http_status.HTTP_200_OK,
)
async def get_users_by_role(
    response: Response,
    role_name: str,
    service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    _, range_, sort, _ = query_parts
    total = await service.count(filter={"v1": role_name, "ptype": "g", "v0__like": "user:%"})
    if total == 0:
        users = []
    else:
        users = await service.get_users_by_role(role_name, range=range_, sort=sort)
    headers = {"Content-Range": f"users 0-{len(users)}/{total}"}
    response.headers.update(headers)
    return users


# Entity permissions
@router.get(
    "/permissions/{entity_name}/{entity_id}/policies",
    response_model=list[PermissionResponse],
    response_description="Get entity policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_entity_permissions(
    entity_name: str,
    entity_id: str,
    response: Response,
    service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    if not is_valid_uuid(entity_id):
        raise ValueError("Invalid entity ID format")

    _, range_, sort, _ = query_parts
    total = await service.count(filter={"ptype": "p", "v1": f"{entity_name}:{entity_id}"})

    if total == 0:
        policies = []
    else:
        policies = await service.get_entity_permissions(entity_name, entity_id, range=range_, sort=sort)

    headers = {"Content-Range": f"policies 0-{len(policies)}/{total}"}
    response.headers.update(headers)
    return policies


@router.post(
    "/permissions/role",
    response_model=PermissionResponse,
    response_model_by_alias=False,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_role(request: Request, body: RoleCreate, service: PermissionService = Depends(get_permission_service)):
    requester: UserDTO = request.state.user
    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create_role(role_name=body.role, user_id=body.user_id, requester=requester)

    return entity


@router.post(
    "/permissions/role/{role_id}/{user_id}",
    response_model=PermissionResponse,
    response_model_by_alias=False,
    status_code=http_status.HTTP_201_CREATED,
)
async def assign_user_to_role(
    request: Request, role_id: UUID | str, user_id: UUID, service: PermissionService = Depends(get_permission_service)
):
    """
    Assign a user to a role by role ID or role name.
    """
    requester: UserDTO = request.state.user

    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    if is_valid_uuid(role_id) is True:
        # get role name from role id
        role = await service.get_by_id(permission_id=role_id)
        if not role:
            raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Role not found")
        if role.ptype != "g":
            raise HTTPException(status_code=400, detail="Permission is not a role")

        if not role.v1:
            raise HTTPException(status_code=400, detail="Role name is missing")
        role_name = role.v1
    else:
        role_name = role_id

    entity = await service.assign_user_to_role(role_name=str(role_name), user_id=user_id, requester=requester)

    return entity


@router.post(
    "/permissions/policy/api",
    response_model=PermissionResponse,
    response_model_by_alias=False,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_api_policy(
    request: Request, body: ApiPolicyCreate, service: PermissionService = Depends(get_permission_service)
):
    requester: UserDTO = request.state.user

    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create_api_policy(body=body, requester=requester)

    return entity


@router.post(
    "/permissions/policy/entity",
    response_model=PermissionResponse,
    response_model_by_alias=False,
    status_code=http_status.HTTP_201_CREATED,
)
async def create_entity_policy(
    request: Request, body: EntityPolicyCreate, service: PermissionService = Depends(get_permission_service)
):
    requester: UserDTO = request.state.user
    if await user_has_access_to_entity(requester, body.entity_id, "admin", body.entity_name) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create_entity_policy(body=body, requester=requester)

    return entity


@router.delete("/permissions/{permission_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, permission_id: str, service: PermissionService = Depends(get_permission_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(permission_id=permission_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")

    await service.delete(permission_id=permission_id, requester=requester)


@router.get(
    "/permissions/{entity_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, entity_id: str, service: PermissionService = Depends(get_permission_service)):
    requester: UserDTO = request.state.user

    actions = await service.get_actions(entity_id, requester=requester)
    return actions
