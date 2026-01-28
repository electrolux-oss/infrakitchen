from typing import Any
from application.executors.service import ExecutorService
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
from .schema import (
    ExecutorCreate,
    ExecutorResponse,
    ExecutorUpdate,
    RoleExecutorsResponse,
    UserExecutorResponse,
)
from .dependencies import get_executor_service

router = APIRouter()


@router.get(
    "/executors/{executor_id}",
    response_model=ExecutorResponse,
    response_description="Get one executor by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(executor_id: str, service: ExecutorService = Depends(get_executor_service)):
    entity = await service.get_by_id(executor_id=executor_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Executor not found")
    return entity


@router.get(
    "/executors",
    response_model=list[dict[str, Any]],
    response_description="Get all executors",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: ExecutorService = Depends(get_executor_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"executors 0-{len(result)}/{total}"}
    response.headers.update(headers)
    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/executors",
    response_model=ExecutorResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: ExecutorCreate, service: ExecutorService = Depends(get_executor_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(executor=body, requester=requester)

    return entity


@router.put(
    "/executors/{executor_id}",
    response_model=ExecutorResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    executor_id: str,
    body: ExecutorUpdate,
    service: ExecutorService = Depends(get_executor_service),
):
    requester: UserDTO = request.state.user
    if ModelActions.EDIT not in await service.get_actions(executor_id=executor_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.EDIT.value}")
    entity = await service.update(executor_id=executor_id, executor=body, requester=requester)
    return entity


@router.patch("/executors/{executor_id}/actions", response_model=ExecutorResponse, status_code=http_status.HTTP_200_OK)
async def patch_action(
    request: Request,
    executor_id: str,
    body: PatchBodyModel,
    service: ExecutorService = Depends(get_executor_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))
    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(executor_id=executor_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch_action(executor_id=executor_id, body=body, requester=requester)

    return entity


@router.delete("/executors/{executor_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, executor_id: str, service: ExecutorService = Depends(get_executor_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(executor_id=executor_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")
    await service.delete(executor_id=executor_id, requester=requester)


@router.get(
    "/executors/{executor_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(request: Request, executor_id: str, service: ExecutorService = Depends(get_executor_service)):
    requester = request.state.user
    return await service.get_actions(executor_id=executor_id, requester=requester)


# Permissions
@router.get(
    "/executors/permissions/user/{user_id}/policies",
    response_model=list[UserExecutorResponse],
    response_description="Get user executor policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_user_executors(user_id: str, service: ExecutorService = Depends(get_executor_service)):
    executors = await service.get_user_executor_policies(user_id)
    return executors


@router.get(
    "/executors/permissions/role/{role_name}/policies",
    response_model=list[RoleExecutorsResponse],
    response_description="Get role policies",
    status_code=http_status.HTTP_200_OK,
)
async def get_executor_role_permissions(
    response: Response,
    role_name: str,
    service: ExecutorService = Depends(get_executor_service),
    permission_service: PermissionService = Depends(get_permission_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    _, range_, sort, _ = query_parts

    total = await permission_service.count(filter={"v0": role_name, "ptype": "p", "v1__like": "executor:"})

    if total == 0:
        result = []
    else:
        result = await service.get_role_permissions(role_name, range=range_, sort=sort)
    headers = {"Content-Range": f"policies 0-{len(result)}/{total}"}
    response.headers.update(headers)

    return result


@router.post(
    "/executors/permissions",
    response_model=list[PermissionResponse],
    response_description="Sync role permissions with executors",
    status_code=http_status.HTTP_201_CREATED,
)
async def create_role_executor_permissions(
    request: Request,
    executor_policy: EntityPolicyCreate,
    service: ExecutorService = Depends(get_executor_service),
):
    requester: UserDTO = request.state.user

    requester_permissions = await user_entity_permissions(requester, executor_policy.entity_id, "executor")
    if "admin" not in requester_permissions:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.create_executor_policy(executor_policy, requester=requester)
