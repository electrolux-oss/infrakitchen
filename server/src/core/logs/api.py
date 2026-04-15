from fastapi import APIRouter, Depends, HTTPException, Response
from fastapi import status as http_status

from core.logs.schema import LogResponse
from core.logs.service import LogService
from core.utils.fastapi_tools import QueryParamsType, parse_query_params
from infrakitchen_mcp.dispatch_framework import get_one_group, list_entities_group
from infrakitchen_mcp.registry import mcp_group
from .dependencies import get_log_service

router = APIRouter()


@router.get(
    "/logs/{entity_id}",
    response_model=LogResponse,
    response_description="Get one log by id",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(get_one_group, "logs", param_renames={"id": "entity_id"})
async def get_by_id(entity_id: str, service: LogService = Depends(get_log_service)):
    entity = await service.get_by_id(entity_id=entity_id)
    if entity is None:
        raise HTTPException(
            status_code=http_status.HTTP_404_NOT_FOUND,
            detail=f"Log with id {entity_id} not found",
        )
    return entity


@router.get(
    "/logs",
    response_model=list[LogResponse],
    response_description="Get all logs",
    status_code=http_status.HTTP_200_OK,
)
@mcp_group(list_entities_group, "logs")
async def get_all(
    response: Response,
    service: LogService = Depends(get_log_service),
    query_parts: QueryParamsType = Depends(parse_query_params),
):
    filter, range_, sort, _ = query_parts
    total = await service.count(filter=filter)

    if total == 0:
        result = []
    else:
        result = list(await service.get_all(filter=filter, range=range_, sort=sort))

    headers = {"Content-Range": f"logs 0-{len(result)}/{total}"}
    response.headers.update(headers)
    return result
