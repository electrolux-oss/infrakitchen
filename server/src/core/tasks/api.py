from fastapi import APIRouter, Depends, Response
from fastapi import status as http_status
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group

from .schema import TaskEntityResponse
from .service import TaskEntityService
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from .dependencies import get_task_service

router = APIRouter()


@router.get(
    "/tasks/{entity_id}",
    response_model=TaskEntityResponse,
    response_description="Get task by entity id",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "tasks", param_renames={"id": "entity_id"})
async def get_by_id(entity_id: str, service: TaskEntityService = Depends(get_task_service)):
    entity = await service.get_by_id(entity_id=entity_id)
    return entity


@router.get(
    "/tasks",
    response_model=list[TaskEntityResponse],
    response_description="Get all tasks",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "tasks")
async def get_all(
    response: Response,
    service: TaskEntityService = Depends(get_task_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))
    headers = {"Content-Range": f"tasks 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result
