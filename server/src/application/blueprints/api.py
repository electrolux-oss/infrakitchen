from typing import Any

from application.blueprints.service import BlueprintService
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from application.workflows.schema import WorkflowRequest, WorkflowResponse
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import (
    BlueprintCreate,
    BlueprintResponse,
    BlueprintUpdate,
)
from .dependencies import get_blueprint_service

router = APIRouter()


# ── Blueprint CRUD ──────────────────────────────────────────────────────────


@router.get(
    "/blueprints/{blueprint_id}",
    response_model=BlueprintResponse,
    response_description="Get one blueprint by id",
    status_code=http_status.HTTP_200_OK,
)
async def get_by_id(blueprint_id: str, service: BlueprintService = Depends(get_blueprint_service)):
    entity = await service.get_by_id(blueprint_id=blueprint_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Blueprint not found")
    return entity


@router.get(
    "/blueprints",
    response_model=list[dict[str, Any]],
    response_description="Get all blueprints",
    status_code=http_status.HTTP_200_OK,
)
async def get_all(
    response: Response,
    service: BlueprintService = Depends(get_blueprint_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, fields = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))

    headers = {"Content-Range": f"blueprints 0-{len(result)}/{total}"}
    response.headers.update(headers)

    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.post(
    "/blueprints",
    response_model=BlueprintResponse,
    status_code=http_status.HTTP_201_CREATED,
)
async def post(request: Request, body: BlueprintCreate, service: BlueprintService = Depends(get_blueprint_service)):
    requester: UserDTO | None = request.state.user

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    entity = await service.create(blueprint=body, requester=requester)
    return entity


@router.patch(
    "/blueprints/{blueprint_id}",
    response_model=BlueprintResponse,
    status_code=http_status.HTTP_200_OK,
)
async def update(
    request: Request,
    blueprint_id: str,
    body: BlueprintUpdate,
    service: BlueprintService = Depends(get_blueprint_service),
):
    requester: UserDTO = request.state.user
    entity = await service.update(blueprint_id=blueprint_id, blueprint=body, requester=requester)
    return entity


@router.patch(
    "/blueprints/{blueprint_id}/actions",
    response_model=BlueprintResponse,
    status_code=http_status.HTTP_200_OK,
)
async def perform_action(
    request: Request,
    blueprint_id: str,
    body: PatchBodyModel,
    service: BlueprintService = Depends(get_blueprint_service),
):
    requester: UserDTO = request.state.user

    actions_list = list(map(lambda x: x.value, ModelActions))
    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if body.action not in await service.get_actions(blueprint_id=blueprint_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch(blueprint_id=blueprint_id, body=body, requester=requester)
    return entity


@router.delete(
    "/blueprints/{blueprint_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
async def delete(request: Request, blueprint_id: str, service: BlueprintService = Depends(get_blueprint_service)):
    requester: UserDTO = request.state.user
    if ModelActions.DELETE not in await service.get_actions(blueprint_id=blueprint_id, requester=requester):
        raise HTTPException(status_code=403, detail=f"Access denied for action {ModelActions.DELETE.value}")

    await service.delete(blueprint_id=blueprint_id, requester=requester)


@router.get(
    "/blueprints/{blueprint_id}/actions",
    response_model=list[str],
    status_code=http_status.HTTP_200_OK,
    response_description="Get user actions for blueprint entity",
)
async def get_actions(request: Request, blueprint_id: str, service: BlueprintService = Depends(get_blueprint_service)):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.get_actions(blueprint_id=blueprint_id, requester=requester)


@router.post(
    "/blueprints/{blueprint_id}/create_workflow",
    response_model=WorkflowResponse,
    status_code=http_status.HTTP_201_CREATED,
    response_description="Create workflows — creates resources in dependency order",
)
async def create_workflow_from_blueprint(
    request: Request,
    blueprint_id: str,
    body: WorkflowRequest,
    service: BlueprintService = Depends(get_blueprint_service),
):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    execution = await service.create_workflow(
        blueprint_id=blueprint_id,
        request=body,
        requester=requester,
    )
    return execution
