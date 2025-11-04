from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.permissions.schema import PermissionCreate, PermissionResponse
from core.users.functions import user_has_access_to_resource
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params

from .service import PermissionService
from .dependencies import get_permission_service

router = APIRouter()


@router.get(
    "/permissions/get_all_subjects",
    response_description="Return full list of available roles",
    response_model=list[str],
)
async def get_all_subjects(response: Response, service: PermissionService = Depends(get_permission_service)):
    subjects = await service.get_all_subjects()

    headers = {"Content-Range": f"roles 0-{len(subjects)}/{len(subjects)}"}
    response.headers.update(headers)
    return subjects


@router.get(
    "/permissions/roles",
    response_model=list[str],
    response_description="Get all roles",
    status_code=http_status.HTTP_200_OK,
)
async def get_all_roles(response: Response, service: PermissionService = Depends(get_permission_service)):
    roles = await service.get_all_roles()

    headers = {"Content-Range": f"roles 0-{len(roles)}/{len(roles)}"}
    response.headers.update(headers)
    return roles


@router.get(
    "/permissions/{entity_id}",
    response_model=PermissionResponse,
    response_description="Get one role by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(request: Request, entity_id: str, service: PermissionService = Depends(get_permission_service)):
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
async def get_user_roles(user_id: str, service: PermissionService = Depends(get_permission_service)):
    roles = await service.get_user_roles(user_id)
    return roles


@router.get(
    "/permissions/user/{user_id}/policies",
    response_model=list[PermissionResponse],
    response_description="Get user policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_user_policies(user_id: str, service: PermissionService = Depends(get_permission_service)):
    policies = await service.get_user_policies(user_id)
    return policies


# Role permissions
@router.get(
    "/permissions/role/{role_name}/policies",
    response_model=list[PermissionResponse],
    response_description="Get role policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_role_permissions(role_name: str, service: PermissionService = Depends(get_permission_service)):
    policies = await service.get_role_permissions(role_name)
    return policies


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
    service: PermissionService = Depends(get_permission_service),
):
    policies = await service.get_entity_permissions(entity_name, entity_id)
    return policies


@router.get(
    "/permissions",
    response_model=list[PermissionResponse],
    response_description="Get all roles",
    response_model_by_alias=False,
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"roles 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result


@router.post(
    "/permissions",
    response_model=PermissionResponse,
    response_model_by_alias=False,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: PermissionCreate, service: PermissionService = Depends(get_permission_service)):
    requester: UserDTO = request.state.user

    entity = await service.create(body=body, requester=requester)

    return entity


@router.delete("/permissions/{entity_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, entity_id: str, service: PermissionService = Depends(get_permission_service)):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, entity_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(permission_id=entity_id, requester=requester)


@router.get(
    "/permissions/{entity_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, entity_id: str, service: PermissionService = Depends(get_permission_service)):
    requester = request.state.user

    actions = await service.get_actions(entity_id, requester=requester)
    return actions
