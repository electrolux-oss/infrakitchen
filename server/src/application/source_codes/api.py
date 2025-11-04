from typing import Any
from application.source_codes.service import SourceCodeService
from core.constants.model import ModelActions
from core.base_models import PatchBodyModel
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from core.users.functions import user_has_access_to_resource
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import SourceCodeCreate, SourceCodeResponse, SourceCodeUpdate
from .dependencies import get_source_code_service

router = APIRouter()


@router.get(
    "/source_codes/{source_code_id}",
    response_model=SourceCodeResponse,
    response_description="Get one source_code by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(source_code_id: str, service: SourceCodeService = Depends(get_source_code_service)):
    entity = await service.get_by_id(source_code_id=source_code_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="SourceCode not found")
    return entity


@router.get(
    "/source_codes",
    response_model=list[dict[str, Any]],
    response_description="Get all source_codes",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: SourceCodeService = Depends(get_source_code_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"source_codes 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/source_codes",
    response_model=SourceCodeResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: SourceCodeCreate, service: SourceCodeService = Depends(get_source_code_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(source_code=body, requester=requester)

    return entity


@router.patch(
    "/source_codes/{source_code_id}",
    response_model=SourceCodeResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    source_code_id: str,
    body: SourceCodeUpdate,
    service: SourceCodeService = Depends(get_source_code_service),
):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, source_code_id, action="write"):
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.update(source_code_id=source_code_id, source_code=body, requester=requester)
    return entity


@router.patch(
    "/source_codes/{source_code_id}/actions", response_model=SourceCodeResponse, status_code=http_status.HTTP_200_OK
)
async def patch_action(
    request: Request,
    source_code_id: str,
    body: PatchBodyModel,
    service: SourceCodeService = Depends(get_source_code_service),
):
    requester: UserDTO = request.state.user
    actions_list = list(map(lambda x: x.value, ModelActions))
    if not await user_has_access_to_resource(requester, source_code_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    entity = await service.patch(source_code_id=source_code_id, body=body, requester=requester)

    return entity


@router.delete("/source_codes/{source_code_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete(request: Request, source_code_id: str, service: SourceCodeService = Depends(get_source_code_service)):
    requester: UserDTO = request.state.user
    if not await user_has_access_to_resource(requester, source_code_id, action="admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(source_code_id=source_code_id, requester=requester)


@router.get(
    "/source_codes/{source_code_id}/actions",
    response_model=list[str],
    response_description="Get user actions for an entity",
    status_code=http_status.HTTP_200_OK,
)
async def get_actions(
    request: Request, source_code_id: str, service: SourceCodeService = Depends(get_source_code_service)
):
    requester = request.state.user
    return await service.get_actions(
        source_code_id=source_code_id,
        requester=requester,
    )
