from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.functions import user_is_super_admin
from core.users.service import UserService
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from .schema import UserCreate, UserResponse, UserUpdate
from .dependencies import get_user_service

router = APIRouter()


@router.get(
    "/users/{user_id}",
    response_model=UserResponse,
    response_description="Get one user by id",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "users", param_renames={"id": "user_id"})
async def get_by_id(user_id: str, service: UserService = Depends(get_user_service)):
    entity = await service.get_by_id(user_id=user_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="User not found")
    return entity


@router.get(
    "/users",
    response_model=list[UserResponse],
    response_description="Get all users",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "users")
async def get_all(
    response: Response,
    service: UserService = Depends(get_user_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"users 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result


@router.post(
    "/users",
    response_model=UserResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: UserCreate, service: UserService = Depends(get_user_service)):
    requester = request.state.user

    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(user=body, requester=requester)

    return entity


@router.patch(
    "/users/{user_id}",
    response_model=UserResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    user_id: str,
    body: UserUpdate,
    service: UserService = Depends(get_user_service),
):
    requester = request.state.user
    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.update(user_id=user_id, user=body, requester=requester)
    return entity


@router.get(
    "/users/{user_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, user_id: str, service: UserService = Depends(get_user_service)):
    requester = request.state.user
    return await service.get_actions(user_id=user_id, requester=requester)


@router.post(
    "/users/{primary_user_id}/link/{secondary_user_id}",
    response_model=UserResponse,
    status_code=http_status.HTTP_200_OK,
)
async def link_accounts(
    request: Request,
    primary_user_id: str,
    secondary_user_id: str,
    service: UserService = Depends(get_user_service),
):
    requester = request.state.user
    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.link_accounts(
        primary_user_id=primary_user_id, secondary_user_id=secondary_user_id, requester=requester
    )
    return entity


@router.delete(
    "/users/{primary_user_id}/link/{secondary_user_id}",
    response_model=UserResponse,
    status_code=http_status.HTTP_200_OK,
)
async def unlink_accounts(
    request: Request,
    primary_user_id: str,
    secondary_user_id: str,
    service: UserService = Depends(get_user_service),
):
    requester = request.state.user
    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.unlink_accounts(
        primary_user_id=primary_user_id, secondary_user_id=secondary_user_id, requester=requester
    )
    return entity
