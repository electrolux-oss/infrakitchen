from core.auth_providers.service import AuthProviderService
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.functions import user_is_super_admin
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import AuthProviderCreate, AuthProviderResponse, AuthProviderUpdate
from .dependencies import get_auth_provider_service

router = APIRouter()


@router.get(
    "/auth_providers/{auth_provider_id}",
    response_model=AuthProviderResponse,
    response_description="Get one auth_provider by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(auth_provider_id: str, service: AuthProviderService = Depends(get_auth_provider_service)):
    entity = await service.get_by_id(auth_provider_id=auth_provider_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="AuthProvider not found")
    return entity


@router.get(
    "/auth_providers",
    response_model=list[AuthProviderResponse],
    response_description="Get all auth_providers",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: AuthProviderService = Depends(get_auth_provider_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"auth_providers 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result


@router.post(
    "/auth_providers",
    response_model=AuthProviderResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(
    request: Request,
    body: AuthProviderCreate,
    service: AuthProviderService = Depends(get_auth_provider_service),
):
    requester: UserDTO = request.state.user
    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(auth_provider=body, requester=requester)

    return entity


@router.patch(
    "/auth_providers/{auth_provider_id}",
    response_model=AuthProviderResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    auth_provider_id: str,
    body: AuthProviderUpdate,
    service: AuthProviderService = Depends(get_auth_provider_service),
):
    requester: UserDTO = request.state.user

    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.update(auth_provider_id=auth_provider_id, auth_provider=body, requester=requester)
    return entity


@router.delete("/auth_providers/{auth_provider_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(
    request: Request, auth_provider_id: str, service: AuthProviderService = Depends(get_auth_provider_service)
):
    requester: UserDTO = request.state.user
    if await user_is_super_admin(requester) is False:
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(auth_provider_id=auth_provider_id, requester=requester)


@router.get(
    "/auth_providers/{auth_provider_id}/actions",
    response_model=list[str],
    response_description="Get user actions for a entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(
    request: Request, auth_provider_id: str, service: AuthProviderService = Depends(get_auth_provider_service)
):
    requester = request.state.user
    return await service.get_actions(auth_provider_id=auth_provider_id, requester=requester)
