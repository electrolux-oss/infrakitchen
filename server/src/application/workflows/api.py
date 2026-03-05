from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi import status as http_status

from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from application.workflows.service import WorkflowService
from core.base_models import PatchBodyModel
from core.constants.model import ModelActions
from core.users.model import UserDTO
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .schema import (
    WorkflowResponse,
)
from .dependencies import get_workflow_service

router = APIRouter()


@router.get(
    "/workflows",
    response_model=list[dict[str, Any]],
    response_description="Get all workflows",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "workflows")
async def get_all(
    response: Response,
    service: WorkflowService = Depends(get_workflow_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
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
            )
        )
    headers = {"Content-Range": f"workflows 0-{len(result)}/{total}"}
    response.headers.update(headers)
    if fields:
        fields.append("_entity_name")
        return [res.model_dump(include=set(fields)) for res in result]
    return [res.model_dump() for res in result]


@router.get(
    "/workflows/{workflow_id}",
    response_model=WorkflowResponse,
    status_code=http_status.HTTP_200_OK,
    response_description="Get a single blueprint execution with its steps",
)
@mcp_group(get_one_group, "workflows")
async def get_workflow(
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
):
    entity = await service.get_by_id(workflow_id=workflow_id)
    if not entity:
        raise HTTPException(status_code=http_status.HTTP_404_NOT_FOUND, detail="Execution not found")
    return entity


@router.patch(
    "/workflows/{workflow_id}/actions",
    response_model=WorkflowResponse,
    status_code=http_status.HTTP_200_OK,
    response_description="Perform an action on a workflow",
)
async def perform_execution_action(
    request: Request,
    workflow_id: str,
    body: PatchBodyModel,
    service: WorkflowService = Depends(get_workflow_service),
):
    requester: UserDTO | None = request.state.user

    actions_list = list(map(lambda x: x.value, ModelActions))
    if body.action not in actions_list:
        raise HTTPException(status_code=400, detail="Invalid action")

    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    # if body.action not in await service.get_execution_actions(workflow_id=workflow_id, requester=requester):
    #     raise HTTPException(status_code=403, detail=f"Access denied for action {body.action}")

    entity = await service.patch_action(workflow_id=workflow_id, body=body, requester=requester)
    return entity


@router.get(
    "/workflows/{workflow_id}/actions",
    response_model=list[str],
    status_code=http_status.HTTP_200_OK,
    response_description="Get user actions for workflow entity",
)
async def get_actions(
    request: Request,
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    return await service.get_workflow_actions(workflow_id=workflow_id, requester=requester)


@router.delete(
    "/workflows/{workflow_id}",
    status_code=http_status.HTTP_204_NO_CONTENT,
)
async def delete_execution(
    request: Request,
    workflow_id: str,
    service: WorkflowService = Depends(get_workflow_service),
):
    requester: UserDTO | None = request.state.user
    if not requester:
        raise HTTPException(status_code=403, detail="Access denied")

    await service.delete(workflow_id=workflow_id, requester=requester)
